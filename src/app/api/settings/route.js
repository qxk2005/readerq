/**
 * 设置 API 路由
 * GET: 获取设置（敏感值脱敏）
 * POST: 保存设置
 */

import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

const SETTING_KEYS = [
  'onboarding_completed',
  'readwise_token',
  'daily_review_target',
  'readwise_official_streak',
  'readwise_official_best_streak',
  'readwise_official_total_highlights',
  'openai_api_key',
  'openai_base_url',
  'openai_model',
  'openai_max_tokens',
  'youtube_cookie',
  'oss_region',
  'oss_bucket',
  'oss_access_key_id',
  'oss_access_key_secret',
  'oss_custom_domain',
  'oss_path_prefix',
  'ui_theme_settings',
  'ui_sidebar_width',
  'ui_doclist_width',
  'ui_rightpanel_width',
  'ui_sidebar_collapsed',
  'home_feed_settings',
  'home_feed_filter_tag',
  'home_feed_summary_max_lines',
  'home_feed_filter_tags',
];

export async function GET() {
  try {
    const settings = {};
    for (const key of SETTING_KEYS) {
      const value = getSetting(key);
      if (value && (key === 'readwise_token' || key === 'openai_api_key' || key === 'oss_access_key_id' || key === 'oss_access_key_secret' || key === 'youtube_cookie')) {
        // 脱敏：只显示前8位和后8位
        settings[key] = value.length > 20
          ? value.substring(0, 8) + '••••••••' + value.substring(value.length - 8)
          : '••••••••';
        settings[key + '_set'] = true;
      } else {
        settings[key] = value || '';
        settings[key + '_set'] = !!value;
      }
    }

    // 检查环境变量是否已设置
    settings.env_readwise_token = !!process.env.READWISE_API_TOKEN;
    settings.env_openai_api_key = !!process.env.OPENAI_API_KEY;
    settings.env_openai_base_url = process.env.OPENAI_BASE_URL || '';
    settings.env_openai_model = process.env.OPENAI_MODEL || '';
    settings.env_openai_max_tokens = process.env.OPENAI_MAX_TOKENS || '';

    return NextResponse.json(settings);
  } catch (error) {
    console.error('获取设置错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    for (const key of SETTING_KEYS) {
      if (body[key] !== undefined && body[key] !== null) {
        // 如果是脱敏值（含 ••••），跳过不更新
        if (typeof body[key] === 'string' && body[key].includes('••••')) {
          continue;
        }
        // 空字符串表示清除设置
        if (body[key] === '') {
          setSetting(key, null);
        } else {
          setSetting(key, body[key]);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存设置错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
