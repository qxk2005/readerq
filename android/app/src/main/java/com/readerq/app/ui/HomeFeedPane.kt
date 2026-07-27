package com.readerq.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.items
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.readerq.app.data.DocumentEntity

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
    val theme by viewModel.theme.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()

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
            // 顶部瀑布流 Header 与搜索过滤
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
                                    text = "${documents.size} 篇",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // 搜索框
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { viewModel.setSearchQuery(it) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
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

            if (documents.isEmpty()) {
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
                            text = if (searchQuery.isNotEmpty()) "未找到相关匹配文章" else "暂无灵感文章",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                }
            } else {
                // 原生折叠屏自适应 LazyVerticalStaggeredGrid 瀑布流卡片列表
                LazyVerticalStaggeredGrid(
                    columns = StaggeredGridCells.Fixed(actualColumns.coerceIn(1, 4)),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalItemSpacing = 10.dp
                ) {
                    items(documents, key = { it.id }) { doc ->
                        HomeFeedCard(
                            doc = doc,
                            showCover = showCover,
                            showSummary = showSummary,
                            cardBg = cardBg,
                            cardBorder = cardBorder,
                            onClick = { onDocumentClick(doc) },
                            onMoveDoc = { location -> viewModel.moveDocument(doc.id, location) }
                        )
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
fun DefaultArtCover(
    doc: DocumentEntity,
    modifier: Modifier = Modifier
) {
    val hash = (doc.id.hashCode() and 0x7FFFFFFF)
    val gradients = listOf(
        listOf(Color(0xFF1A2A6C), Color(0xFFB21F1F), Color(0xFFFDBB2D)),
        listOf(Color(0xFF0F2027), Color(0xFF203A43), Color(0xFF2C5364)),
        listOf(Color(0xFF3A1C71), Color(0xFFD76D77), Color(0xFFFFAF7B)),
        listOf(Color(0xFF134E5E), Color(0xFF71B280)),
        listOf(Color(0xFF1D2671), Color(0xFFC33764)),
        listOf(Color(0xFF304352), Color(0xFF434343)),
        listOf(Color(0xFF00416A), Color(0xFFE4E5E6)),
        listOf(Color(0xFF2C3E50), Color(0xFF4CA1AF))
    )
    val colorList = gradients[hash % gradients.size]

    val locationLabel = when (doc.location.lowercase()) {
        "new", "inbox" -> "📥 收件箱"
        "feed", "rss" -> "📡 RSS 订阅"
        "later" -> "⏰ 稍后读"
        "archive" -> "📦 归档"
        else -> "📄 ${doc.location.uppercase()}"
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 130.dp, max = 170.dp)
            .background(Brush.linearGradient(colorList))
            .padding(14.dp)
    ) {
        // 背景气泡光效
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawCircle(
                color = Color.White.copy(alpha = 0.08f),
                radius = size.minDimension * 0.8f,
                center = androidx.compose.ui.geometry.Offset(size.width * 0.85f, size.height * 0.2f)
            )
        }

        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // 顶部来源与类型 Chip
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = Color.Black.copy(alpha = 0.45f)
                ) {
                    Text(
                        text = locationLabel,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }

                if (!doc.site_name.isNullOrBlank()) {
                    Text(
                        text = doc.site_name!!,
                        fontSize = 10.sp,
                        color = Color.White.copy(alpha = 0.75f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // 直接在海报封面上精美渲染文章标题
            Text(
                text = doc.title.ifBlank { "无标题文章" },
                fontSize = 15.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                lineHeight = 20.sp,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
fun HomeFeedCard(
    doc: DocumentEntity,
    showCover: Boolean,
    showSummary: Boolean,
    cardBg: Color,
    cardBorder: Color,
    onClick: () -> Unit,
    onMoveDoc: (String) -> Unit
) {
    val locationLabel = when (doc.location.lowercase()) {
        "new", "inbox" -> "📥 收件箱"
        "feed", "rss" -> "📡 RSS 订阅"
        "later" -> "⏰ 稍后读"
        "archive" -> "📦 归档"
        else -> "📄 ${doc.location.uppercase()}"
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(0.8.dp, cardBorder, RoundedCornerShape(16.dp))
            .clickable { onClick() },
        color = cardBg,
        tonalElevation = 1.dp
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // 1. 文章封面 (如果有网络大图则展示 AsyncImage，无图片则自动生成融合标题与来源的艺术 DefaultArtCover)
            if (showCover) {
                if (!doc.image_url.isNullOrBlank()) {
                    Box(modifier = Modifier.fillMaxWidth()) {
                        AsyncImage(
                            model = doc.image_url,
                            contentDescription = doc.title,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 110.dp, max = 220.dp)
                                .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                        )
                        // 图片卡片上的来源 Badge
                        Surface(
                            modifier = Modifier
                                .padding(10.dp)
                                .align(Alignment.TopStart),
                            shape = RoundedCornerShape(6.dp),
                            color = Color.Black.copy(alpha = 0.55f)
                        ) {
                            Text(
                                text = locationLabel,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                            )
                        }
                    }
                } else {
                    DefaultArtCover(
                        doc = doc,
                        modifier = Modifier.clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                    )
                }
            }

            Column(modifier = Modifier.padding(14.dp)) {
                // 2. 来源位置 & 分类 Meta 标签行 (当未显示封面时展现)
                if (!showCover) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = Color(0xFF007AFF).copy(alpha = 0.12f)
                            ) {
                                Text(
                                    text = locationLabel,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF007AFF),
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                            if (!doc.category.isNullOrBlank()) {
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f)
                                ) {
                                    Text(
                                        text = doc.category!!.uppercase(),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }

                        if (!doc.author.isNullOrBlank()) {
                            Text(
                                text = doc.author!!,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                // 3. 文章标题 (如果无封面，在正文中展示标题)
                if (!showCover || !doc.image_url.isNullOrBlank()) {
                    Text(
                        text = doc.title.ifBlank { "无标题文章" },
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        lineHeight = 20.sp,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // 4. 摘要 (Summary)
                if (showSummary && !doc.summary.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = doc.summary!!,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.68f),
                        lineHeight = 17.sp,
                        maxLines = 4,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // 5. 阅读进度条
                if (doc.reading_progress > 0f && doc.reading_progress < 1f) {
                    Spacer(modifier = Modifier.height(10.dp))
                    LinearProgressIndicator(
                        progress = doc.reading_progress,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .clip(RoundedCornerShape(2.dp)),
                        color = Color(0xFF007AFF),
                        trackColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f)
                    )
                }

                // 6. 底部快捷 Action 操作行
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = doc.reading_time ?: "1 min",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f)
                    )

                    Row {
                        IconButton(
                            onClick = { onMoveDoc("later") },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(
                                Icons.Default.DateRange,
                                contentDescription = "稍后读",
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                            )
                        }

                        IconButton(
                            onClick = { onMoveDoc("archive") },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = "归档",
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                            )
                        }
                    }
                }
            }
        }
    }
}
