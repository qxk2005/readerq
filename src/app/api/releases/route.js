/**
 * GitHub Releases API 路由
 * 获取 ReaderQ 仓库的所有发布版本信息
 * 使用内存缓存避免频繁请求 GitHub API
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GITHUB_REPO = 'qxk2005/readerq';
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

let cachedData = null;
let cacheTimestamp = 0;

export async function GET() {
  try {
    const now = Date.now();

    // 检查缓存
    if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        releases: cachedData,
        cached: true,
        currentVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
      });
    }

    // 请求 GitHub API（公共仓库不需要 token）
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=50`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ReaderQ-App',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API 请求失败 (${response.status})`);
    }

    const releases = await response.json();

    // 精简数据，只保留前端需要的字段
    const formattedReleases = releases.map(release => ({
      tag_name: release.tag_name,
      name: release.name || release.tag_name,
      body: release.body || '',
      published_at: release.published_at,
      prerelease: release.prerelease,
      draft: release.draft,
      html_url: release.html_url,
      assets: (release.assets || []).map(asset => ({
        name: asset.name,
        size: asset.size,
        download_url: asset.browser_download_url,
      })),
    })).filter(r => !r.draft); // 过滤掉草稿

    // 更新缓存
    cachedData = formattedReleases;
    cacheTimestamp = now;

    return NextResponse.json({
      success: true,
      releases: formattedReleases,
      cached: false,
      currentVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    });
  } catch (error) {
    console.error('获取 GitHub Releases 失败:', error);
    return NextResponse.json(
      {
        error: error.message || '获取版本信息失败',
        currentVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
      },
      { status: 500 }
    );
  }
}
