package com.readerq.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridItemSpan
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.readerq.app.R
import com.readerq.app.data.DocumentEntity
import kotlinx.serialization.json.Json

fun getDocTags(doc: DocumentEntity): List<String> {
    val jsonStr = doc.tags_json ?: return emptyList()
    return try {
        if (jsonStr.startsWith("{")) {
            Json.decodeFromString<Map<String, Int>>(jsonStr).keys.toList()
        } else if (jsonStr.startsWith("[")) {
            Json.decodeFromString<List<String>>(jsonStr)
        } else emptyList()
    } catch (e: Exception) {
        emptyList()
    }
}

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
fun HomeFeedPane(
    viewModel: MainViewModel,
    onDocumentClick: (DocumentEntity) -> Unit
) {
    val documents by viewModel.documents.collectAsState()
    val userColumns by viewModel.homeFeedColumns.collectAsState()
    val showSummary by viewModel.homeFeedShowSummary.collectAsState()
    val showCover by viewModel.homeFeedShowCover.collectAsState()
    val summaryMaxLines by viewModel.homeFeedSummaryMaxLines.collectAsState()
    val showHighlightsCount by viewModel.homeFeedShowHighlightsCount.collectAsState()
    val theme by viewModel.theme.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()

    // 桌面版控制栏相关 Flow 状态
    val currentHomeTab by viewModel.homeFeedTab.collectAsState()
    val prioritizeInbox by viewModel.homeFeedPrioritizeInbox.collectAsState()
    val filterTags by viewModel.homeFeedFilterTags.collectAsState()
    val visibleLimit by viewModel.homeFeedLimit.collectAsState()

    val cardBg = when (theme) {
        "light" -> Color(0xFFFFFFFF)
        "sepia" -> Color(0xFFEFECE6)
        else -> Color(0xFF1E1E1E)
    }

    val cardBorder = when (theme) {
        "light" -> Color(0xFFE5E7EB)
        "sepia" -> Color(0xFFE4DFD5)
        else -> Color(0xFF2D2D2D)
    }

    // 过滤与排序逻辑 (支持优先收件箱与多标签匹配)
    val filteredDocs = remember(documents, searchQuery, currentHomeTab, prioritizeInbox, filterTags) {
        var list = documents.filter { doc ->
            !doc.location.equals("archive", ignoreCase = true) && !doc.location.equals("trash", ignoreCase = true)
        }
        if (searchQuery.isNotBlank()) {
            list = list.filter {
                it.title.contains(searchQuery, ignoreCase = true) ||
                (it.summary?.contains(searchQuery, ignoreCase = true) == true)
            }
        } else if (currentHomeTab == "tag" && filterTags.isNotEmpty()) {
            list = list.filter { doc ->
                val tags = getDocTags(doc).map { it.lowercase() }
                filterTags.any { filterTag -> tags.contains(filterTag.lowercase()) }
            }
        }

        if (prioritizeInbox) {
            list.sortedWith(
                compareByDescending<DocumentEntity> { it.location.equals("new", ignoreCase = true) }
                    .thenByDescending { it.created_at ?: "" }
            )
        } else {
            list.sortedByDescending { it.created_at ?: "" }
        }
    }

    val visibleDocs = filteredDocs.take(visibleLimit)
    val hasMore = visibleDocs.size < filteredDocs.size

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(
                when (theme) {
                    "light" -> Color(0xFFFCFCFA)
                    "sepia" -> Color(0xFFF4F1EB)
                    else -> Color(0xFF121212)
                }
            )
    ) {
        val screenWidth = maxWidth
        // 折叠屏与多端自适应列数计算
        val actualColumns = remember(screenWidth, userColumns) {
            if (userColumns > 0) {
                userColumns
            } else {
                when {
                    screenWidth < 480.dp -> 1
                    screenWidth < 840.dp -> 2
                    screenWidth < 1200.dp -> 3
                    else -> 4
                }
            }
        }

        Column(modifier = Modifier.fillMaxSize()) {
            // 顶部瀑布流 Header 与桌面级控制栏
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = cardBg,
                tonalElevation = 2.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    // 1. 标题与数量 Badge
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.Menu,
                                contentDescription = "首页瀑布流",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "首页灵感流",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                            ) {
                                Text(
                                    text = "${filteredDocs.size} 篇",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // 2. 桌面经典顶部控制 Bar (最新加入 | 优先收件箱 | 标签)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Pill 1: 最新加入 / 所有灵感
                        val isAllSelected = currentHomeTab == "all"
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = if (isAllSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f) else cardBorder.copy(alpha = 0.3f),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isAllSelected) MaterialTheme.colorScheme.primary else cardBorder
                            ),
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .clickable { viewModel.setHomeFeedTab("all") }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "🕒 最新加入",
                                    fontSize = 12.sp,
                                    fontWeight = if (isAllSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isAllSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }

                        // Pill 2: 优先收件箱
                        val inboxBg by animateColorAsState(
                            targetValue = if (prioritizeInbox) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f) else cardBorder.copy(alpha = 0.3f),
                            label = "inboxBg"
                        )
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = inboxBg,
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (prioritizeInbox) MaterialTheme.colorScheme.primary else cardBorder
                            ),
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .clickable { viewModel.toggleHomeFeedPrioritizeInbox() }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (prioritizeInbox) "📥 优先收件箱 (已开启)" else "📥 优先收件箱",
                                    fontSize = 12.sp,
                                    fontWeight = if (prioritizeInbox) FontWeight.Bold else FontWeight.Normal,
                                    color = if (prioritizeInbox) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }

                        // Pill 3: 标签多规则筛选流
                        val isTagSelected = currentHomeTab == "tag"
                        val tagLabel = if (filterTags.isNotEmpty()) "🏷️ 标签: ${filterTags.joinToString(",")}" else "🏷️ 标签"
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = if (isTagSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f) else cardBorder.copy(alpha = 0.3f),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isTagSelected) MaterialTheme.colorScheme.primary else cardBorder
                            ),
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .clickable { viewModel.setHomeFeedTab("tag") }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = tagLabel,
                                    fontSize = 12.sp,
                                    fontWeight = if (isTagSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isTagSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // 3. 搜索框
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { viewModel.setSearchQuery(it) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp),
                        placeholder = { Text("搜索全库灵感与文章...", fontSize = 13.sp) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp)) },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { viewModel.setSearchQuery("") }) {
                                    Icon(Icons.Default.Close, contentDescription = "清除", modifier = Modifier.size(16.dp))
                                }
                            }
                        },
                        shape = RoundedCornerShape(24.dp),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = cardBorder
                        )
                    )
                }
            }

            Divider(color = cardBorder, thickness = 0.5.dp)

            if (filteredDocs.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Star,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = if (searchQuery.isNotEmpty()) "未找到相关匹配文章" else "暂无该筛选规则下的灵感文章",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                }
            } else {
                // 原生折叠屏自适应 LazyVerticalStaggeredGrid 瀑布流卡片列表 (支持渐进式无限加载)
                LazyVerticalStaggeredGrid(
                    columns = StaggeredGridCells.Fixed(actualColumns.coerceIn(1, 4)),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalItemSpacing = 10.dp
                ) {
                    items(visibleDocs, key = { it.id }) { doc ->
                        HomeFeedCard(
                            doc = doc,
                            showCover = showCover,
                            showSummary = showSummary,
                            summaryMaxLines = summaryMaxLines,
                            showHighlightsCount = showHighlightsCount,
                            cardBg = cardBg,
                            cardBorder = cardBorder,
                            onClick = { onDocumentClick(doc) },
                            onMoveDoc = { location -> viewModel.moveDocument(doc.id, location) }
                        )
                    }

                    // 渐进式分页触底 Load More 区域
                    item(span = StaggeredGridItemSpan.FullLine) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            if (hasMore) {
                                Button(
                                    onClick = { viewModel.loadMoreHomeFeed() },
                                    shape = RoundedCornerShape(20.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f))
                                ) {
                                    Text(
                                        text = "✨ 滑动已呈 ${visibleDocs.size} / ${filteredDocs.size} 篇 · 点击加载更多",
                                        color = MaterialTheme.colorScheme.primary,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            } else {
                                Text(
                                    text = "🎉 已为您完整呈现全部 ${filteredDocs.size} 篇灵感文章",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * 精美艺术海报封面 (直接在渐变气泡封面上渲染完整标题与来源分类)
 */
@Composable
fun HomeFeedCard(
    doc: DocumentEntity,
    showCover: Boolean,
    showSummary: Boolean,
    summaryMaxLines: Int,
    showHighlightsCount: Boolean,
    cardBg: Color,
    cardBorder: Color,
    onClick: () -> Unit,
    onMoveDoc: (String) -> Unit
) {
    val title = doc.title.ifBlank { "无标题文档" }
    val isInbox = doc.location.equals("new", ignoreCase = true)
    
    val categoryLabel = remember(doc) {
        when {
            doc.location.equals("feed", ignoreCase = true) || !doc.site_name.isNullOrBlank() -> "RSS · ${doc.site_name ?: "订阅"}"
            doc.category.equals("book", ignoreCase = true) -> "书籍"
            doc.category.equals("pdf", ignoreCase = true) -> "PDF / 电子书"
            doc.category.equals("video", ignoreCase = true) -> "视频"
            doc.category.equals("email", ignoreCase = true) -> "邮件"
            doc.category.equals("tweet", ignoreCase = true) -> "推特"
            isInbox -> "收件箱"
            else -> "文章"
        }
    }

    val posterGradient = remember(doc.id) {
        val hash = (doc.id.hashCode() and 0x7FFFFFFF)
        val gradients = listOf(
            listOf(Color(0xFF2C3E50), Color(0xFF4CA1AF)),
            listOf(Color(0xFF654ea3), Color(0xFFeaafc8)),
            listOf(Color(0xFF16A085), Color(0xFFF4D03F)),
            listOf(Color(0xFF4568DC), Color(0xFFB06AB3)),
            listOf(Color(0xFF43C6AC), Color(0xFFF8FFAE)),
            listOf(Color(0xFF00B4DB), Color(0xFF0083B0)),
            listOf(Color(0xFF8E2DE2), Color(0xFF4A00E0)),
            listOf(Color(0xFFD31027), Color(0xFFEA384D))
        )
        gradients[hash % gradients.size]
    }

    val tagList = remember(doc) { getDocTags(doc) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, cardBorder, RoundedCornerShape(16.dp))
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = cardBg),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            if (showCover) {
                if (!doc.image_url.isNullOrBlank()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(150.dp)
                    ) {
                        AsyncImage(
                            model = doc.image_url,
                            contentDescription = title,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                        // 顶部 Badge
                        CategoryBadge(
                            categoryLabel = categoryLabel,
                            isInbox = isInbox,
                            modifier = Modifier.align(Alignment.TopStart).padding(8.dp)
                        )
                    }
                } else {
                    // 无图片时动态艺术海报封面
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(135.dp)
                            .background(Brush.linearGradient(posterGradient))
                            .padding(12.dp)
                    ) {
                        CategoryBadge(
                            categoryLabel = categoryLabel,
                            isInbox = isInbox,
                            modifier = Modifier.align(Alignment.TopStart)
                        )

                        Text(
                            text = title,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.align(Alignment.BottomStart)
                        )
                    }
                }
            }

            // 卡片下半部分文本与信息
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp)
            ) {
                if (!showCover) {
                    CategoryBadge(
                        categoryLabel = categoryLabel,
                        isInbox = isInbox,
                        modifier = Modifier.padding(bottom = 6.dp)
                    )
                }

                Text(
                    text = title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                if (showSummary && !doc.summary.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = doc.summary,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                        lineHeight = 17.sp,
                        maxLines = if (summaryMaxLines > 0) summaryMaxLines else Int.MAX_VALUE,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                if (tagList.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        tagList.take(3).forEach { t ->
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.06f)
                            ) {
                                Text(
                                    text = "#$t",
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // 底部作者、阅读时长与划线数
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (!doc.author.isNullOrBlank()) {
                            Text(
                                text = doc.author,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.widthIn(max = 90.dp)
                            )
                            Text("·", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f))
                        }
                        
                        Text(
                            text = "${doc.reading_time ?: 3} min",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                        )
                    }

                    if (showHighlightsCount && !doc.notes.isNullOrBlank()) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFFFF9500).copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = "🖍️ 1",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFFF9500),
                                modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CategoryBadge(
    categoryLabel: String,
    isInbox: Boolean,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = if (isInbox) Color(0xFFFF3B30).copy(alpha = 0.85f) else Color.Black.copy(alpha = 0.55f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (isInbox) {
                Text(
                    text = "📥 收件箱",
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            } else {
                Text(
                    text = categoryLabel,
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}
