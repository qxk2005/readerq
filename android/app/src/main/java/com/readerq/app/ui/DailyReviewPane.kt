package com.readerq.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.readerq.app.data.DocumentEntity
import com.readerq.app.data.HighlightEntity
import kotlinx.serialization.json.Json

fun parseHlTags(tagsJson: String?): List<String> {
    if (tagsJson.isNullOrBlank()) return emptyList()
    return try {
        if (tagsJson.startsWith("[")) {
            Json.decodeFromString<List<String>>(tagsJson)
        } else {
            Json.decodeFromString<Map<String, Int>>(tagsJson).keys.toList()
        }
    } catch (e: Exception) {
        emptyList()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DailyReviewPane(
    viewModel: MainViewModel,
    onDocumentClick: (DocumentEntity) -> Unit
) {
    val rawHighlights by viewModel.reviewHighlights.collectAsState()
    val highlights = remember(rawHighlights) {
        rawHighlights.filter { it.text.trim().isNotEmpty() || !it.note.isNullOrBlank() }
    }
    val currentIndex by viewModel.reviewCurrentIndex.collectAsState()
    val subTab by viewModel.reviewSubTab.collectAsState()
    val documents by viewModel.documents.collectAsState()
    val theme by viewModel.theme.collectAsState()

    val reviewedCountToday by viewModel.reviewedCountToday.collectAsState()
    val streakDays by viewModel.streakDays.collectAsState()

    val uriHandler = LocalUriHandler.current

    var showAddTagDialog by remember { mutableStateOf(false) }
    var tagInputText by remember { mutableStateOf("") }

    val currentHl = if (highlights.isNotEmpty()) highlights[currentIndex.coerceIn(0, highlights.size - 1)] else null
    val currentDoc = remember(currentHl, documents) {
        if (currentHl != null) {
            documents.find { it.id == currentHl.document_id }
        } else null
    }

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

    val textColor = MaterialTheme.colorScheme.onSurface

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                when (theme) {
                    "light" -> Color(0xFFFCFCFA)
                    "sepia" -> Color(0xFFF4F1EB)
                    else -> Color(0xFF121212)
                }
            )
            .padding(16.dp)
    ) {
        // 1. 顶部 Header 与切换 Button 组
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                    modifier = Modifier.size(40.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("✨", fontSize = 20.sp)
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "每日回顾 (Daily Review)",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = textColor
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = Color(0xFFFF9500).copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = "Review",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFFF9500),
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                    Text(
                        text = "基于 Readwise 间隔重复算法，重温灵感划线",
                        fontSize = 12.sp,
                        color = textColor.copy(alpha = 0.6f)
                    )
                }
            }

            // 右侧选项卡 Pill (每日高亮 / 回顾统计)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FilterChip(
                    selected = subTab == "daily",
                    onClick = { viewModel.setReviewSubTab("daily") },
                    label = { Text("📖 每日高亮 (${highlights.size})", fontSize = 12.sp) }
                )
                FilterChip(
                    selected = subTab == "stats",
                    onClick = { viewModel.setReviewSubTab("stats") },
                    label = { Text("📊 回顾统计", fontSize = 12.sp) }
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (subTab == "daily") {
            if (highlights.isEmpty()) {
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
                            modifier = Modifier.size(56.dp),
                            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "暂无需要回顾的高亮划线",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = textColor
                        )
                        Text(
                            text = "阅读文章并添加划线，系统将基于 Readwise 间隔重复算法自动精选回顾",
                            fontSize = 13.sp,
                            color = textColor.copy(alpha = 0.6f)
                        )
                    }
                }
            } else if (currentHl != null) {
                // 2. 进度条 (Progress Counter Bar)
                val totalCount = highlights.size
                val progressFraction = (currentIndex + 1).toFloat() / totalCount.toFloat()

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "卡片 ${currentIndex + 1} / $totalCount",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = textColor.copy(alpha = 0.7f)
                    )

                    LinearProgressIndicator(
                        progress = progressFraction,
                        modifier = Modifier
                            .width(180.dp)
                            .height(6.dp)
                            .clip(CircleShape),
                        color = MaterialTheme.colorScheme.primary,
                        trackColor = cardBorder
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // 3. 回顾卡片主 Container
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    shape = RoundedCornerShape(20.dp),
                    color = cardBg,
                    border = BorderStroke(1.dp, cardBorder),
                    shadowElevation = 4.dp
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(20.dp),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(
                            modifier = Modifier
                                .weight(1f, fill = false)
                                .verticalScroll(rememberScrollState())
                        ) {
                            // 3.1 卡片头部：文章信息与操作组
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                                        modifier = Modifier.size(36.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(
                                                text = currentDoc?.title?.take(1)?.uppercase() ?: "📖",
                                                fontWeight = FontWeight.Bold,
                                                color = MaterialTheme.colorScheme.primary
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column {
                                        Text(
                                            text = currentDoc?.title ?: "精选选段",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = textColor,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text = "作者: ${currentDoc?.author ?: "未知作者"}",
                                            fontSize = 12.sp,
                                            color = textColor.copy(alpha = 0.5f)
                                        )
                                    }
                                }

                                // 右侧操作组 (本文全部高亮 | 外部打开)
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    if (currentDoc != null) {
                                        OutlinedButton(
                                            onClick = { onDocumentClick(currentDoc) },
                                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                            shape = RoundedCornerShape(12.dp)
                                        ) {
                                            Text(":= 本文全部高亮 ›", fontSize = 11.sp)
                                        }
                                    }

                                    if (!currentDoc?.url.isNullOrBlank()) {
                                        IconButton(onClick = { currentDoc?.url?.let { uriHandler.openUri(it) } }) {
                                            Icon(Icons.Default.Share, contentDescription = "外部打开", modifier = Modifier.size(18.dp))
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // 3.2 划线正文引用框 (典雅黄色边框指示)
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                                    .border(
                                        BorderStroke(1.dp, Color(0xFFFFB300).copy(alpha = 0.5f)),
                                        RoundedCornerShape(12.dp)
                                    )
                                    .padding(16.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(IntrinsicSize.Min)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .width(4.dp)
                                            .fillMaxHeight()
                                            .background(Color(0xFFFFB300), RoundedCornerShape(2.dp))
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    HighlightContentWithImages(
                                        text = currentHl.text,
                                        textColor = textColor,
                                        fontSize = 16.sp,
                                        lineHeight = 24.sp,
                                        fontWeight = FontWeight.Medium,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }

                            if (!currentHl.note.isNullOrBlank()) {
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(
                                    text = "💡 笔记想法: ${currentHl.note}",
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // 3.3 标签区与 + 添加标签按钮
                            val hlTags = remember(currentHl) { parseHlTags(currentHl.tags_json) }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                hlTags.forEach { tag ->
                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                                    ) {
                                        Text(
                                            text = "#$tag",
                                            fontSize = 11.sp,
                                            color = MaterialTheme.colorScheme.primary,
                                            fontWeight = FontWeight.SemiBold,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                        )
                                    }
                                }

                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = cardBorder,
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .clickable { showAddTagDialog = true }
                                ) {
                                    Text(
                                        text = "+ 添加标签",
                                        fontSize = 11.sp,
                                        color = textColor.copy(alpha = 0.7f),
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }

                        // 3.4 底部三主键 (上一条 | 收藏(F)同步Readwise | 已复习/下一条(Space)同步Readwise)
                        val isFavorite = remember(currentHl) {
                            val tags = parseHlTags(currentHl.tags_json)
                            tags.contains("favorite") || tags.contains("收藏")
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // 上一条
                            Button(
                                onClick = { viewModel.prevReviewCard() },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = cardBorder)
                            ) {
                                Text("‹ 上一条", color = textColor, fontSize = 13.sp)
                            }

                            // 收藏 (F) - 同步 Readwise
                            OutlinedButton(
                                onClick = { viewModel.toggleReviewHighlightFavorite(currentHl) },
                                modifier = Modifier.weight(1.2f),
                                shape = RoundedCornerShape(14.dp),
                                border = BorderStroke(1.dp, if (isFavorite) Color(0xFFFF3B30) else cardBorder)
                            ) {
                                Text(
                                    text = if (isFavorite) "♥ 已收藏 (F)" else "♡ 收藏 (F)",
                                    color = if (isFavorite) Color(0xFFFF3B30) else textColor,
                                    fontSize = 13.sp,
                                    fontWeight = if (isFavorite) FontWeight.Bold else FontWeight.Normal
                                )
                            }

                            // 已复习 / 下一条 (Space) - 同步 Readwise
                            Button(
                                onClick = { viewModel.nextReviewCard() },
                                modifier = Modifier.weight(1.8f),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                            ) {
                                Text("已复习 / 下一条 (Space) ›", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        } else {
            // 4. 统计 Tab (回顾统计)
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    color = cardBg,
                    border = BorderStroke(1.dp, cardBorder),
                    shadowElevation = 2.dp
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text("🔥 连续打卡复习成就", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = textColor)
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceAround
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("$streakDays 天", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Color(0xFFFF9500))
                                Text("连续打卡天数", fontSize = 12.sp, color = textColor.copy(alpha = 0.6f))
                            }

                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("$reviewedCountToday 条", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                Text("今日已复习金句", fontSize = 12.sp, color = textColor.copy(alpha = 0.6f))
                            }

                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("${highlights.size} 条", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Color(0xFF34C759))
                                Text("本轮预排卡片", fontSize = 12.sp, color = textColor.copy(alpha = 0.6f))
                            }
                        }
                    }
                }

                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    color = cardBg,
                    border = BorderStroke(1.dp, cardBorder),
                    shadowElevation = 2.dp
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text("☁️ Readwise 云端同步与 SRS 记忆算法", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = textColor)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "每次复习卡片、添加标签或点亮收藏，系统都会自动通过 Readwise V2 API 将最新交互结果实时同步至 Readwise 后台数据库，保持多端数据 100% 严格一致。",
                            fontSize = 13.sp,
                            lineHeight = 19.sp,
                            color = textColor.copy(alpha = 0.7f)
                        )
                    }
                }
            }
        }
    }

    // 5. 标签添加对话框
    if (showAddTagDialog && currentHl != null) {
        AlertDialog(
            onDismissRequest = { showAddTagDialog = false },
            title = { Text("为划线金句添加标签", fontSize = 16.sp, fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = tagInputText,
                    onValueChange = { tagInputText = it },
                    placeholder = { Text("例如: AI, 思考, 方法论", fontSize = 13.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(onClick = {
                    if (tagInputText.isNotBlank()) {
                        viewModel.addReviewHighlightTag(currentHl, tagInputText)
                        tagInputText = ""
                        showAddTagDialog = false
                    }
                }) {
                    Text("添加并同步至 Readwise")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddTagDialog = false }) {
                    Text("取消")
                }
            }
        )
    }
}
