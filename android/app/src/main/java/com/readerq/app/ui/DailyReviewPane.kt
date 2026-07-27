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

    var showEditHlDialog by remember { mutableStateOf(false) }
    var editHlText by remember { mutableStateOf("") }
    var editHlNote by remember { mutableStateOf("") }

    val currentHl = if (highlights.isNotEmpty()) highlights[currentIndex.coerceIn(0, highlights.size - 1)] else null
    val currentDoc = remember(currentHl, documents) {
        if (currentHl != null) {
            documents.find { doc ->
                doc.id == currentHl.document_id ||
                (!doc.source_url.isNullOrBlank() && (doc.source_url == currentHl.document_id || currentHl.document_id.contains(doc.source_url))) ||
                (!doc.url.isNullOrBlank() && (doc.url == currentHl.document_id || currentHl.document_id.contains(doc.url))) ||
                (!currentHl.document_title.isNullOrBlank() && doc.title.trim().equals(currentHl.document_title?.trim(), ignoreCase = true))
            }
        } else null
    }

    val displayTitle = remember(currentHl, currentDoc) {
        when {
            !currentDoc?.title.isNullOrBlank() -> currentDoc!!.title
            !currentHl?.document_title.isNullOrBlank() -> currentHl!!.document_title!!
            !currentHl?.document_id.isNullOrBlank() && (currentHl!!.document_id.startsWith("http://") || currentHl!!.document_id.startsWith("https://")) -> {
                try {
                    val host = java.net.URI(currentHl.document_id).host
                    if (!host.isNullOrBlank()) "文章来自: $host" else currentHl.document_id
                } catch (e: Exception) {
                    currentHl.document_id
                }
            }
            !currentHl?.text.isNullOrBlank() -> {
                val cleanText = currentHl!!.text.replace(Regex("[*#`_~\\s]"), "")
                if (cleanText.length > 18) "${cleanText.take(18)}..." else cleanText
            }
            else -> "每日划线选段"
        }
    }

    val displayAuthor = remember(currentHl, currentDoc) {
        val rawAuthor = currentDoc?.author?.ifBlank { null }
            ?: currentHl?.author?.ifBlank { null }
            ?: currentDoc?.site_name?.ifBlank { null }

        if (!rawAuthor.isNullOrBlank() && rawAuthor != "未知作者") {
            "作者: $rawAuthor"
        } else if (!currentDoc?.site_name.isNullOrBlank()) {
            "来源: ${currentDoc!!.site_name}"
        } else {
            null
        }
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

    val isReviewCompleted by viewModel.isReviewCompleted.collectAsState()
    val isSyncingReviewComplete by viewModel.isSyncingReviewComplete.collectAsState()
    val reviewCompleteSyncSuccess by viewModel.reviewCompleteSyncSuccess.collectAsState()

    if (subTab == "daily") {
        if (isReviewCompleted) {
            // 🏆 胜利结算界面 (Victory Screen)
            val totalCount = highlights.size
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "🎉 每日回顾完成 ($totalCount / $totalCount)",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF34C759)
                )

                LinearProgressIndicator(
                    progress = 1.0f,
                    modifier = Modifier
                        .width(180.dp)
                        .height(6.dp)
                        .clip(CircleShape),
                    color = Color(0xFF34C759),
                    trackColor = cardBorder
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                shape = RoundedCornerShape(20.dp),
                color = cardBg,
                border = BorderStroke(1.5.dp, Color(0xFF34C759).copy(alpha = 0.5f)),
                shadowElevation = 6.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp)
                        .verticalScroll(rememberScrollState()),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Spacer(modifier = Modifier.height(12.dp))

                        // 成就图标
                        Surface(
                            shape = CircleShape,
                            color = Color(0xFFFF9500).copy(alpha = 0.15f),
                            modifier = Modifier.size(72.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("🏆", fontSize = 36.sp)
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = "🎉 恭喜完成今日每日回顾！",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = textColor
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = "您已成功阅读并复习全部 $totalCount 条精选划线金句，脑海知识库再度激活！",
                            fontSize = 13.sp,
                            color = textColor.copy(alpha = 0.7f),
                            lineHeight = 18.sp
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        // 数据统计卡片
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            color = MaterialTheme.colorScheme.surface,
                            border = BorderStroke(1.dp, cardBorder)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceAround
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("$streakDays 天", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFFF9500))
                                    Text("连续打卡天数", fontSize = 11.sp, color = textColor.copy(alpha = 0.6f))
                                }

                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("$reviewedCountToday 条", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                    Text("今日复习金句", fontSize = 11.sp, color = textColor.copy(alpha = 0.6f))
                                }

                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("$totalCount 条", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFF34C759))
                                    Text("本轮回顾数量", fontSize = 11.sp, color = textColor.copy(alpha = 0.6f))
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // ✅ Readwise 云端同步完成状态通知 (真实打卡状态)
                        val isSuccess = reviewCompleteSyncSuccess == true
                        val isFailed = reviewCompleteSyncSuccess == false
                        val themeColor = if (isSyncingReviewComplete) MaterialTheme.colorScheme.primary else if (isSuccess) Color(0xFF34C759) else Color(0xFFFF9500)

                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            color = themeColor.copy(alpha = 0.1f),
                            border = BorderStroke(1.dp, themeColor.copy(alpha = 0.3f))
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Surface(
                                    shape = CircleShape,
                                    color = themeColor,
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        if (isSyncingReviewComplete) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(20.dp),
                                                color = Color.White,
                                                strokeWidth = 2.dp
                                            )
                                        } else {
                                            Icon(
                                                if (isSuccess) Icons.Default.Check else Icons.Default.Refresh,
                                                contentDescription = null,
                                                tint = Color.White,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.width(14.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = if (isSyncingReviewComplete) "⌛ 正在同步至 Readwise 官方..." 
                                                   else if (isSuccess) "✅ Readwise 官方后台打卡成功" 
                                                   else "⚠️ Readwise 官方同步需要重试",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isSuccess) Color(0xFF2E7D32) else themeColor
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Surface(
                                            shape = RoundedCornerShape(4.dp),
                                            color = themeColor.copy(alpha = 0.2f)
                                        ) {
                                            Text(
                                                text = if (isSyncingReviewComplete) "同步中" else if (isSuccess) "已100%同步" else "待重试",
                                                fontSize = 10.sp,
                                                color = if (isSuccess) Color(0xFF2E7D32) else themeColor,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = if (isSyncingReviewComplete) "正在将本轮 $totalCount 条划线打卡记录向 Readwise 官方 API 发送 POST 标记..."
                                               else if (isSuccess) "本轮 $totalCount 条划线复习记录与 Complete 打卡指令已成功发送至 Readwise 官方 API，readwise.io 后台状态同步成功。"
                                               else "本地复习进度已妥善保存。请点击右侧重试按钮，向 Readwise 官方提交打卡完成指令。",
                                        fontSize = 12.sp,
                                        color = textColor.copy(alpha = 0.8f),
                                        lineHeight = 16.sp
                                    )
                                }

                                if (isFailed && !isSyncingReviewComplete) {
                                    Spacer(modifier = Modifier.width(8.dp))
                                    IconButton(onClick = { viewModel.submitOfficialReviewComplete() }) {
                                        Icon(Icons.Default.Refresh, contentDescription = "重试同步", tint = themeColor)
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // 底部控制操作组
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = { viewModel.restartReviewSession() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("开启新一轮随机回顾 (${totalCount}条)", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = { viewModel.prevReviewCard() },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(14.dp),
                                border = BorderStroke(1.dp, cardBorder)
                            ) {
                                Text("‹ 返回上一条", color = textColor, fontSize = 13.sp)
                            }

                            OutlinedButton(
                                onClick = { viewModel.setReviewSubTab("stats") },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(14.dp),
                                border = BorderStroke(1.dp, cardBorder)
                            ) {
                                Text("📊 查看回顾统计", color = textColor, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }
        } else if (highlights.isEmpty()) {
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
                                .weight(1f)
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
                                                text = displayTitle.take(1).uppercase(),
                                                fontWeight = FontWeight.Bold,
                                                color = MaterialTheme.colorScheme.primary
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column(
                                        modifier = Modifier.clickable(enabled = currentDoc != null) {
                                            currentDoc?.let { onDocumentClick(it) }
                                        }
                                    ) {
                                        Text(
                                            text = displayTitle,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = textColor,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        if (displayAuthor != null) {
                                            Text(
                                                text = displayAuthor,
                                                fontSize = 12.sp,
                                                color = textColor.copy(alpha = 0.5f)
                                            )
                                        }
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
                                val noteAnnotatedText = buildMarkdownAnnotatedString(
                                    input = "💡 笔记想法: ${currentHl.note}",
                                    textColor = MaterialTheme.colorScheme.primary
                                )
                                Text(
                                    text = noteAnnotatedText,
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.primary
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
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Add,
                                            contentDescription = null,
                                            tint = textColor.copy(alpha = 0.7f),
                                            modifier = Modifier.size(13.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = "添加标签",
                                            fontSize = 11.sp,
                                            color = textColor.copy(alpha = 0.8f),
                                            fontWeight = FontWeight.Medium
                                        )
                                    }
                                }

                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .clickable {
                                            editHlText = currentHl.text
                                            editHlNote = currentHl.note ?: ""
                                            showEditHlDialog = true
                                        }
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Edit,
                                            contentDescription = "编辑",
                                            tint = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.size(13.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = "编辑划线/笔记",
                                            fontSize = 11.sp,
                                            color = MaterialTheme.colorScheme.primary,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
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

                            // 已复习 / 下一条 - 同步 Readwise
                            val isLastCard = currentIndex == highlights.size - 1
                            Button(
                                onClick = { viewModel.nextReviewCard() },
                                modifier = Modifier.weight(1.8f),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (isLastCard) Color(0xFF34C759) else MaterialTheme.colorScheme.primary
                                )
                            ) {
                                Text(
                                    text = if (isLastCard) "🎉 完成复习 ›" else "下一条 ›",
                                    color = Color.White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
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

    // 5. 标签添加对话框 (带自动完成与常用标签选择)
    if (showAddTagDialog && currentHl != null) {
        val allTags by viewModel.allTags.collectAsState()
        val currentHlTags = remember(currentHl) { parseHlTags(currentHl.tags_json) }

        // 提取最后一个英文/中文输入片段用于匹配
        val currentQuery = remember(tagInputText) {
            val parts = tagInputText.split(",", "，")
            parts.lastOrNull()?.trim() ?: ""
        }

        // 匹配未被当前划线添加的候选标签列表
        val matchedTags = remember(allTags, currentQuery, currentHlTags) {
            val candidate = if (currentQuery.isBlank()) {
                allTags
            } else {
                allTags.filter { it.contains(currentQuery, ignoreCase = true) }
            }
            candidate.filter { !currentHlTags.contains(it) }.take(12)
        }

        AlertDialog(
            onDismissRequest = { showAddTagDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.AddCircle,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("为划线金句添加标签", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = tagInputText,
                        onValueChange = { tagInputText = it },
                        placeholder = { Text("例如: AI, 思考, 方法论", fontSize = 13.sp) },
                        singleLine = true,
                        trailingIcon = {
                            if (tagInputText.isNotEmpty()) {
                                IconButton(onClick = { tagInputText = "" }) {
                                    Icon(Icons.Default.Clear, contentDescription = "清空", modifier = Modifier.size(18.dp))
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // 自动完成 / 候选标签 Chips
                    Text(
                        text = if (currentQuery.isBlank()) "💡 现有常用标签 (点击快捷添加):" else "🔍 匹配的标签 (点击自动完成):",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = textColor.copy(alpha = 0.7f)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    if (matchedTags.isNotEmpty()) {
                        androidx.compose.foundation.lazy.LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            items(matchedTags.size) { idx ->
                                val tag = matchedTags[idx]
                                FilterChip(
                                    selected = false,
                                    onClick = {
                                        val parts = tagInputText.split(",", "，").map { it.trim() }.filter { it.isNotEmpty() }
                                        val newParts = if (currentQuery.isNotBlank() && parts.isNotEmpty()) {
                                            parts.dropLast(1) + tag
                                        } else {
                                            parts + tag
                                        }
                                        tagInputText = newParts.distinct().joinToString(", ")
                                    },
                                    label = { Text("#$tag", fontSize = 12.sp) },
                                    leadingIcon = {
                                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp))
                                    },
                                    shape = RoundedCornerShape(12.dp),
                                    colors = FilterChipDefaults.filterChipColors(
                                        containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                                        labelColor = MaterialTheme.colorScheme.primary
                                    )
                                )
                            }
                        }
                    } else {
                        Text(
                            text = if (currentQuery.isBlank()) "暂无现有标签，请输入自定义标签" else "未搜到匹配标签，将自动创建新标签 \"$currentQuery\"",
                            fontSize = 11.sp,
                            color = textColor.copy(alpha = 0.5f),
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (tagInputText.isNotBlank()) {
                        viewModel.addReviewHighlightTag(currentHl, tagInputText)
                        tagInputText = ""
                        showAddTagDialog = false
                    }
                }) {
                    Text("添加")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddTagDialog = false }) {
                    Text("取消")
                }
            }
        )
    }

    // 6. 划线与笔记编辑对话框
    if (showEditHlDialog && currentHl != null) {
        AlertDialog(
            onDismissRequest = { showEditHlDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Edit,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("编辑划线金句与笔记", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text("划线金句正文:", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = textColor.copy(alpha = 0.7f))
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(
                        value = editHlText,
                        onValueChange = { editHlText = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 90.dp, max = 180.dp),
                        maxLines = 6
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    Text("笔记感悟 (可选):", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = textColor.copy(alpha = 0.7f))
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(
                        value = editHlNote,
                        onValueChange = { editHlNote = it },
                        placeholder = { Text("记录下您此时的思考与心得...", fontSize = 13.sp) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 70.dp, max = 140.dp),
                        maxLines = 4
                    )
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (editHlText.isNotBlank()) {
                        viewModel.updateReviewHighlightTextAndNote(currentHl, editHlText, editHlNote)
                        showEditHlDialog = false
                    }
                }) {
                    Text("保存并同步至 Readwise")
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditHlDialog = false }) {
                    Text("取消")
                }
            }
        )
    }
}
