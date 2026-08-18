package com.readerq.app.ui

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Close
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.readerq.app.data.DocumentEntity
import com.readerq.app.data.HighlightEntity
import kotlinx.serialization.json.Json
import com.readerq.app.api.HighlightImage
import com.readerq.app.R
import androidx.compose.ui.res.painterResource
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import androidx.compose.ui.graphics.luminance
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReadingPane(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null
) {
    val doc by viewModel.selectedDoc.collectAsState()
    val highlights by viewModel.highlights.collectAsState()
    val ttsState by viewModel.ttsState.collectAsState()
    val blogContent by viewModel.blogContent.collectAsState()
    val context = LocalContext.current

    val theme by viewModel.theme.collectAsState()
    val fontSize by viewModel.fontSize.collectAsState()
    val fontFamily by viewModel.fontFamily.collectAsState()
    val lineHeight by viewModel.lineHeight.collectAsState()
    val contentWidth by viewModel.contentWidth.collectAsState()

    var selectedTextForHighlight by remember { mutableStateOf<String?>(null) }
    var selectedImagesForHighlight by remember { mutableStateOf<List<HighlightImage>>(emptyList()) }
    var showHighlightCreator by remember { mutableStateOf(false) }
    var isPickerMode by remember { mutableStateOf(false) }
    var readingModeTab by remember { mutableStateOf("text") }
    var videoReadingMode by remember { mutableStateOf("lyrics") } // "lyrics" (歌词) | "blog" (博客) | "subtitles" (字幕)
    val detailPaneType by viewModel.detailPaneType.collectAsState()
    var webViewRefState by remember { mutableStateOf<WebView?>(null) }
    var quoteJumpTrigger by remember { mutableStateOf(0) }
    var pendingHighlightToScroll by remember { mutableStateOf<Pair<String, String>?>(null) }
    var pendingExternalUrl by remember { mutableStateOf<String?>(null) }

    var showAaSheet by remember { mutableStateOf(false) }
    var showNotebookSheet by remember { mutableStateOf(false) }
    var showAiSheet by remember { mutableStateOf(false) }
    var showInfoSheet by remember { mutableStateOf(false) }
    var showOverflowMenu by remember { mutableStateOf(false) }

    var showAiDialog by remember { mutableStateOf(false) }
    var aiCommandType by remember { mutableStateOf("") }
    var aiCommandText by remember { mutableStateOf("") }
    var pendingConfirmAction by remember { mutableStateOf<PendingConfirmAction?>(null) }

    val textColor = MaterialTheme.colorScheme.onBackground
    val appBarBg = MaterialTheme.colorScheme.surface

    if (pendingConfirmAction != null) {
        val action = pendingConfirmAction!!
        AlertDialog(
            onDismissRequest = { pendingConfirmAction = null },
            title = { Text(action.title) },
            text = { Text(action.text) },
            confirmButton = {
                TextButton(
                    onClick = {
                        val onConfirm = action.onConfirm
                        pendingConfirmAction = null
                        onConfirm()
                    }
                ) {
                    Text(
                        action.confirmText,
                        color = if (action.isDanger) Color(0xFFEF4444) else MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingConfirmAction = null }) {
                    Text("取消")
                }
            }
        )
    }

    pendingExternalUrl?.let { url ->
        AlertDialog(
            onDismissRequest = { pendingExternalUrl = null },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_link),
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "外部链接跳转",
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                }
            },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "您正在点击文章中的外部超链接：",
                        fontSize = 13.5.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = url,
                            fontSize = 12.5.sp,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(10.dp),
                            maxLines = 4,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val targetUrl = pendingExternalUrl
                        pendingExternalUrl = null
                        if (!targetUrl.isNullOrBlank()) {
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(targetUrl))
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                context.startActivity(intent)
                            } catch (e: Exception) {
                                Toast.makeText(context, "无法打开浏览器: ${e.message}", Toast.LENGTH_SHORT).show()
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("在默认浏览器中打开", color = Color.White, fontSize = 13.5.sp)
                }
            },
            dismissButton = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(
                        onClick = { pendingExternalUrl = null }
                    ) {
                        Text("取消", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.5.sp)
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                    OutlinedButton(
                        onClick = {
                            val targetUrl = pendingExternalUrl
                            if (!targetUrl.isNullOrBlank()) {
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                val clip = ClipData.newPlainText("URL", targetUrl)
                                clipboard.setPrimaryClip(clip)
                                Toast.makeText(context, "已复制链接到剪贴板", Toast.LENGTH_SHORT).show()
                            }
                            pendingExternalUrl = null
                        },
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("复制链接", fontSize = 13.5.sp)
                    }
                }
            },
            shape = RoundedCornerShape(16.dp)
        )
    }

    doc?.let { currentDoc ->
        // 文档切换时初始化模式
        LaunchedEffect(currentDoc.id) {
            if (currentDoc.category == "video") {
                videoReadingMode = "lyrics"
            } else {
                readingModeTab = "text"
            }
        }

        // 监听右侧详情边栏弹出状态：若在歌词模式下打开了侧边栏，自动切换为博客模式
        LaunchedEffect(detailPaneType) {
            if (detailPaneType != null && currentDoc.category == "video") {
                if (videoReadingMode == "lyrics") {
                    videoReadingMode = "blog"
                }
            }
        }

        LaunchedEffect(viewModel, currentDoc.id) {
            viewModel.scrollToHighlightEvent.collect { hlId ->
                val targetHl = viewModel.highlights.value.find { it.id == hlId }
                val hlText = targetHl?.text ?: ""
                val isBlogHl = targetHl?.tags_json?.let { it.contains("\"blog\"") || it.contains("blog") } ?: false
                
                val isVideoDoc = currentDoc.category == "video"
                if (isVideoDoc) {
                    if (isBlogHl) {
                        videoReadingMode = "blog"
                    }
                    pendingHighlightToScroll = Pair(hlId, hlText)
                    val hlStr = org.json.JSONObject.quote(hlId)
                    val textStr = org.json.JSONObject.quote(hlText)
                    val js = "if (typeof window.scrollToHighlight === 'function') { window.scrollToHighlight($hlStr, $textStr); }"
                    webViewRefState?.evaluateJavascript(js, null)
                } else {
                    val targetMode = if (isBlogHl) "blog" else "text"
                    val needModeSwitch = if (isBlogHl) {
                        readingModeTab != "blog"
                    } else {
                        readingModeTab == "blog"
                    }

                    if (needModeSwitch) {
                        readingModeTab = targetMode
                        pendingHighlightToScroll = Pair(hlId, hlText)
                    } else {
                        pendingHighlightToScroll = Pair(hlId, hlText)
                        val hlStr = org.json.JSONObject.quote(hlId)
                        val textStr = org.json.JSONObject.quote(hlText)
                        val js = "if (typeof window.scrollToHighlight === 'function') { window.scrollToHighlight($hlStr, $textStr); }"
                        webViewRefState?.evaluateJavascript(js, null)
                    }
                }
            }
        }
        BoxWithConstraints(
            modifier = modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            val paneWidth = maxWidth
            val isNarrowVideoPill = paneWidth < 620.dp
            val isNarrowArticlePill = paneWidth < 420.dp

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.background)
            ) {
                // Distraction-free Document Top Bar
                TopAppBar(
                    title = {
                        Text(
                            text = currentDoc.title,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            fontSize = 15.sp,
                            color = textColor,
                            fontWeight = FontWeight.SemiBold
                        )
                    },
                    navigationIcon = {
                        if (onBack != null) {
                            IconButton(onClick = onBack) {
                                Icon(
                                    imageVector = Icons.Default.ArrowBack,
                                    contentDescription = "Back",
                                    tint = textColor
                                )
                            }
                        } else {
                            // 在双栏模式下，常驻展示侧边栏展开/折叠按钮，点击切换列表显示，保持当前文章继续阅读
                            val isSidebarCollapsed by viewModel.isSidebarCollapsed.collectAsState()
                            IconButton(onClick = {
                                viewModel.toggleSidebarCollapsed()
                            }) {
                                Icon(
                                    painter = painterResource(id = R.drawable.ic_sidebar_toggle),
                                    contentDescription = if (isSidebarCollapsed) "展开文档列表" else "收起文档列表",
                                    tint = textColor,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    },
                    actions = {
                        if (currentDoc.category == "video") {
                            if (isNarrowVideoPill) {
                                // 紧凑下拉小药丸
                                var isVideoMenuOpen by remember { mutableStateOf(false) }
                                val currentModeLabel = when (videoReadingMode) {
                                    "blog" -> "✨ 博客"
                                    "subtitles" -> "字幕"
                                    else -> "歌词"
                                }
                                val isBlog = videoReadingMode == "blog"
                                Box(modifier = Modifier.padding(end = 4.dp)) {
                                    Surface(
                                        shape = RoundedCornerShape(14.dp),
                                        color = if (isBlog) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                                        border = BorderStroke(1.dp, if (isBlog) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f)),
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(14.dp))
                                            .clickable { isVideoMenuOpen = true }
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)
                                        ) {
                                            Text(
                                                text = currentModeLabel,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (isBlog) Color.White else MaterialTheme.colorScheme.onSurface
                                            )
                                            Icon(
                                                imageVector = Icons.Default.ArrowDropDown,
                                                contentDescription = "切换视频模式",
                                                tint = if (isBlog) Color.White else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }
                                    }

                                    DropdownMenu(
                                        expanded = isVideoMenuOpen,
                                        onDismissRequest = { isVideoMenuOpen = false }
                                    ) {
                                        DropdownMenuItem(
                                            text = {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.SpaceBetween,
                                                    modifier = Modifier.fillMaxWidth()
                                                ) {
                                                    Text(
                                                        "🎵 沉浸歌词",
                                                        fontSize = 13.sp,
                                                        fontWeight = if (videoReadingMode == "lyrics") FontWeight.Bold else FontWeight.Normal,
                                                        color = if (videoReadingMode == "lyrics") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                                                    )
                                                    if (videoReadingMode == "lyrics") {
                                                        Text("  ✓", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                                    }
                                                }
                                            },
                                            onClick = {
                                                videoReadingMode = "lyrics"
                                                viewModel.closeDetailPane()
                                                isVideoMenuOpen = false
                                            }
                                        )
                                        DropdownMenuItem(
                                            text = {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.SpaceBetween,
                                                    modifier = Modifier.fillMaxWidth()
                                                ) {
                                                    Text(
                                                        "✨ 视频博客",
                                                        fontSize = 13.sp,
                                                        fontWeight = if (videoReadingMode == "blog") FontWeight.Bold else FontWeight.Normal,
                                                        color = if (videoReadingMode == "blog") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                                                    )
                                                    if (videoReadingMode == "blog") {
                                                        Text("  ✓", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                                    }
                                                }
                                            },
                                            onClick = {
                                                videoReadingMode = "blog"
                                                isVideoMenuOpen = false
                                            }
                                        )
                                        DropdownMenuItem(
                                            text = {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.SpaceBetween,
                                                    modifier = Modifier.fillMaxWidth()
                                                ) {
                                                    Text(
                                                        "📝 双语字幕",
                                                        fontSize = 13.sp,
                                                        fontWeight = if (videoReadingMode == "subtitles") FontWeight.Bold else FontWeight.Normal,
                                                        color = if (videoReadingMode == "subtitles") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                                                    )
                                                    if (videoReadingMode == "subtitles") {
                                                        Text("  ✓", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                                    }
                                                }
                                            },
                                            onClick = {
                                                videoReadingMode = "subtitles"
                                                isVideoMenuOpen = false
                                            }
                                        )
                                    }
                                }
                            } else {
                                // 完整三段式平铺药丸
                                Surface(
                                    shape = RoundedCornerShape(16.dp),
                                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f)),
                                    modifier = Modifier.padding(end = 6.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(2.dp)
                                    ) {
                                        // 1. 歌词 (默认项)
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = if (videoReadingMode == "lyrics") MaterialTheme.colorScheme.surface else Color.Transparent,
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(12.dp))
                                                .clickable {
                                                    videoReadingMode = "lyrics"
                                                    viewModel.closeDetailPane()
                                                }
                                        ) {
                                            Text(
                                                "歌词",
                                                fontSize = 12.sp,
                                                fontWeight = if (videoReadingMode == "lyrics") FontWeight.Bold else FontWeight.Normal,
                                                color = if (videoReadingMode == "lyrics") MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                                modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp)
                                            )
                                        }
                                        // 2. 博客
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = if (videoReadingMode == "blog") MaterialTheme.colorScheme.primary else Color.Transparent,
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(12.dp))
                                                .clickable {
                                                    videoReadingMode = "blog"
                                                }
                                        ) {
                                            Text(
                                                "✨ 博客",
                                                fontSize = 12.sp,
                                                fontWeight = if (videoReadingMode == "blog") FontWeight.Bold else FontWeight.Normal,
                                                color = if (videoReadingMode == "blog") Color.White else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                                modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp)
                                            )
                                        }
                                        // 3. 字幕
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = if (videoReadingMode == "subtitles") MaterialTheme.colorScheme.surface else Color.Transparent,
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(12.dp))
                                                .clickable {
                                                    videoReadingMode = "subtitles"
                                                }
                                        ) {
                                            Text(
                                                "字幕",
                                                fontSize = 12.sp,
                                                fontWeight = if (videoReadingMode == "subtitles") FontWeight.Bold else FontWeight.Normal,
                                                color = if (videoReadingMode == "subtitles") MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                                modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        } else {
                            if (isNarrowArticlePill) {
                                // 普通文章紧凑下拉小药丸
                                var isArticleMenuOpen by remember { mutableStateOf(false) }
                                val currentModeLabel = if (readingModeTab == "blog") "✨ 博客" else "正文"
                                val isBlog = readingModeTab == "blog"
                                Box(modifier = Modifier.padding(end = 4.dp)) {
                                    Surface(
                                        shape = RoundedCornerShape(14.dp),
                                        color = if (isBlog) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                                        border = BorderStroke(1.dp, if (isBlog) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f)),
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(14.dp))
                                            .clickable { isArticleMenuOpen = true }
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)
                                        ) {
                                            Text(
                                                text = currentModeLabel,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (isBlog) Color.White else MaterialTheme.colorScheme.onSurface
                                            )
                                            Icon(
                                                imageVector = Icons.Default.ArrowDropDown,
                                                contentDescription = "切换阅读模式",
                                                tint = if (isBlog) Color.White else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }
                                    }

                                    DropdownMenu(
                                        expanded = isArticleMenuOpen,
                                        onDismissRequest = { isArticleMenuOpen = false }
                                    ) {
                                        DropdownMenuItem(
                                            text = {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.SpaceBetween,
                                                    modifier = Modifier.fillMaxWidth()
                                                ) {
                                                    Text(
                                                        "📄 提取正文",
                                                        fontSize = 13.sp,
                                                        fontWeight = if (readingModeTab == "text") FontWeight.Bold else FontWeight.Normal,
                                                        color = if (readingModeTab == "text") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                                                    )
                                                    if (readingModeTab == "text") {
                                                        Text("  ✓", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                                    }
                                                }
                                            },
                                            onClick = {
                                                readingModeTab = "text"
                                                isArticleMenuOpen = false
                                            }
                                        )
                                        DropdownMenuItem(
                                            text = {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.SpaceBetween,
                                                    modifier = Modifier.fillMaxWidth()
                                                ) {
                                                    Text(
                                                        "✨ 文章博客",
                                                        fontSize = 13.sp,
                                                        fontWeight = if (readingModeTab == "blog") FontWeight.Bold else FontWeight.Normal,
                                                        color = if (readingModeTab == "blog") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                                                    )
                                                    if (readingModeTab == "blog") {
                                                        Text("  ✓", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                                    }
                                                }
                                            },
                                            onClick = {
                                                readingModeTab = "blog"
                                                isArticleMenuOpen = false
                                            }
                                        )
                                    }
                                }
                            } else {
                                // 非视频文章「正文 ↔ 博客」双态一键切换 Segmented 按钮
                                Surface(
                                    shape = RoundedCornerShape(16.dp),
                                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f)),
                                    modifier = Modifier.padding(end = 6.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(2.dp)
                                    ) {
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = if (readingModeTab == "text") MaterialTheme.colorScheme.surface else Color.Transparent,
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(12.dp))
                                                .clickable { readingModeTab = "text" }
                                        ) {
                                            Text(
                                                "正文",
                                                fontSize = 12.sp,
                                                fontWeight = if (readingModeTab == "text") FontWeight.Bold else FontWeight.Normal,
                                                color = if (readingModeTab == "text") MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                            )
                                        }
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = if (readingModeTab == "blog") MaterialTheme.colorScheme.primary else Color.Transparent,
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(12.dp))
                                                .clickable {
                                                    readingModeTab = "blog"
                                                }
                                        ) {
                                            Text(
                                                "✨ 博客",
                                                fontSize = 12.sp,
                                                fontWeight = if (readingModeTab == "blog") FontWeight.Bold else FontWeight.Normal,
                                                color = if (readingModeTab == "blog") Color.White else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }

                    // 🎯 点选高亮 Target 开关按钮 (单色 Vector Icon，风格与 Notebook/AI 100% 保持一致)
                    IconButton(onClick = {
                        isPickerMode = !isPickerMode
                        val modeStr = if (isPickerMode) "true" else "false"
                        webViewRefState?.evaluateJavascript("if (window.setPickerMode) window.setPickerMode($modeStr);", null)
                        Toast.makeText(context, if (isPickerMode) "点选高亮已开启：请依次点击【起点】和【终点】" else "已退出点选模式", Toast.LENGTH_SHORT).show()
                    }) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_target),
                            contentDescription = "点选高亮",
                            tint = if (isPickerMode) MaterialTheme.colorScheme.primary else textColor,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    // Notebook Highlights Icon
                    IconButton(onClick = {
                        if (onBack == null) {
                            val currentType = viewModel.detailPaneType.value
                            if (currentType == "notebook") {
                                viewModel.closeDetailPane()
                            } else {
                                viewModel.openDetailPane("notebook")
                            }
                        } else {
                            showNotebookSheet = true
                        }
                    }) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_tab_notebook),
                            contentDescription = "Notebook Highlights",
                            tint = textColor,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    // AI Assistant Icon
                    IconButton(onClick = {
                        if (onBack == null) {
                            val currentType = viewModel.detailPaneType.value
                            if (currentType == "ai") {
                                viewModel.closeDetailPane()
                            } else {
                                viewModel.openDetailPane("ai")
                            }
                        } else {
                            showAiSheet = true
                        }
                    }) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_ai_assistant),
                            contentDescription = "AI Assistant",
                            tint = textColor,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    // Overflow Actions Icon
                    Box {
                        IconButton(onClick = { showOverflowMenu = true }) {
                            Icon(
                                imageVector = Icons.Default.MoreVert,
                                contentDescription = "More",
                                tint = textColor
                            )
                        }
                        DropdownMenu(
                            expanded = showOverflowMenu,
                            onDismissRequest = { showOverflowMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("朗读文章") },
                                leadingIcon = {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_play),
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp),
                                        tint = textColor
                                    )
                                },
                                onClick = {
                                    showOverflowMenu = false
                                    currentDoc.html_content?.let { html ->
                                        viewModel.startTts(html)
                                    }
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("分享文章") },
                                leadingIcon = {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_share),
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp),
                                        tint = textColor
                                    )
                                },
                                onClick = {
                                    showOverflowMenu = false
                                    val shareUrl = currentDoc.source_url ?: currentDoc.url
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    val clip = ClipData.newPlainText("文章链接", shareUrl)
                                    clipboard.setPrimaryClip(clip)
                                    Toast.makeText(context, "文章链接已复制到剪贴板", Toast.LENGTH_SHORT).show()
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("字体设置") },
                                leadingIcon = {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_font),
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp),
                                        tint = textColor
                                    )
                                },
                                onClick = {
                                    showOverflowMenu = false
                                    if (onBack == null) {
                                        val currentType = viewModel.detailPaneType.value
                                        if (currentType == "aa") {
                                            viewModel.closeDetailPane()
                                        } else {
                                            viewModel.openDetailPane("aa")
                                        }
                                    } else {
                                        showAaSheet = true
                                    }
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("元数据关于") },
                                leadingIcon = {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_info),
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp),
                                        tint = textColor
                                    )
                                },
                                onClick = {
                                    showOverflowMenu = false
                                    showInfoSheet = true
                                }
                            )
                            Divider(color = Color.Gray.copy(alpha = 0.2f))
                            DropdownMenuItem(
                                text = { Text("重新生成 AI 博客") },
                                leadingIcon = {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_ai_assistant),
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp),
                                        tint = MaterialTheme.colorScheme.primary
                                    )
                                },
                                onClick = {
                                    showOverflowMenu = false
                                    readingModeTab = "blog"
                                    viewModel.generateBlogForDocument(currentDoc.id, currentDoc.title)
                                }
                            )
                            if (currentDoc.location == "trash") {
                                DropdownMenuItem(
                                    text = { Text("恢复文章", color = MaterialTheme.colorScheme.primary) },
                                    leadingIcon = {
                                        Icon(
                                            painter = painterResource(id = R.drawable.ic_check),
                                            contentDescription = null,
                                            modifier = Modifier.size(18.dp),
                                            tint = MaterialTheme.colorScheme.primary
                                        )
                                    },
                                    onClick = {
                                        showOverflowMenu = false
                                        pendingConfirmAction = PendingConfirmAction(
                                            title = "恢复文章",
                                            text = "确定要恢复该文章吗？",
                                            confirmText = "恢复",
                                            isDanger = false,
                                            onConfirm = {
                                                viewModel.restoreDocument(currentDoc.id)
                                                onBack?.invoke()
                                            }
                                        )
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text("彻底删除", color = Color.Red) },
                                    leadingIcon = {
                                        Icon(
                                            painter = painterResource(id = R.drawable.ic_delete),
                                            contentDescription = null,
                                            modifier = Modifier.size(18.dp),
                                            tint = Color.Red
                                        )
                                    },
                                    onClick = {
                                        showOverflowMenu = false
                                        pendingConfirmAction = PendingConfirmAction(
                                            title = "彻底删除文章",
                                            text = "确定要彻底删除该文章吗？此操作无法撤销！",
                                            confirmText = "彻底删除",
                                            isDanger = true,
                                            onConfirm = {
                                                viewModel.permanentlyDeleteDocument(currentDoc.id)
                                                onBack?.invoke()
                                            }
                                        )
                                    }
                                )
                            } else if (currentDoc.location == "archive") {
                                DropdownMenuItem(
                                    text = { Text("恢复至收件箱", color = MaterialTheme.colorScheme.primary) },
                                    leadingIcon = {
                                        Icon(
                                            painter = painterResource(id = R.drawable.ic_inbox),
                                            contentDescription = null,
                                            modifier = Modifier.size(18.dp),
                                            tint = MaterialTheme.colorScheme.primary
                                        )
                                    },
                                    onClick = {
                                        showOverflowMenu = false
                                        pendingConfirmAction = PendingConfirmAction(
                                            title = "恢复文章",
                                            text = "确定要将文章从归档区恢复至收件箱吗？",
                                            confirmText = "恢复",
                                            isDanger = false,
                                            onConfirm = {
                                                viewModel.restoreDocument(currentDoc.id)
                                                onBack?.invoke()
                                            }
                                        )
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text("移入垃圾箱", color = Color.Red) },
                                    leadingIcon = {
                                        Icon(
                                            painter = painterResource(id = R.drawable.ic_delete),
                                            contentDescription = null,
                                            modifier = Modifier.size(18.dp),
                                            tint = Color.Red
                                        )
                                    },
                                    onClick = {
                                        showOverflowMenu = false
                                        pendingConfirmAction = PendingConfirmAction(
                                            title = "移至废纸篓",
                                            text = "确定要将文章移至废纸篓吗？",
                                            confirmText = "移至废纸篓",
                                            isDanger = true,
                                            onConfirm = {
                                                viewModel.deleteDocument(currentDoc.id)
                                                onBack?.invoke()
                                            }
                                        )
                                    }
                                )
                            } else {
                                DropdownMenuItem(
                                    text = { Text("归档文章", color = MaterialTheme.colorScheme.primary) },
                                    leadingIcon = {
                                        Icon(
                                            painter = painterResource(id = R.drawable.ic_archive),
                                            contentDescription = null,
                                            modifier = Modifier.size(18.dp),
                                            tint = MaterialTheme.colorScheme.primary
                                        )
                                    },
                                    onClick = {
                                        showOverflowMenu = false
                                        pendingConfirmAction = PendingConfirmAction(
                                            title = "归档文章",
                                            text = "确定要归档该文章吗？",
                                            confirmText = "归档",
                                            isDanger = false,
                                            onConfirm = {
                                                viewModel.archiveDocument(currentDoc.id)
                                                onBack?.invoke()
                                            }
                                        )
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text("删除文章", color = Color.Red) },
                                    leadingIcon = {
                                        Icon(
                                            painter = painterResource(id = R.drawable.ic_delete),
                                            contentDescription = null,
                                            modifier = Modifier.size(18.dp),
                                            tint = Color.Red
                                        )
                                    },
                                    onClick = {
                                        showOverflowMenu = false
                                        pendingConfirmAction = PendingConfirmAction(
                                            title = "移至废纸篓",
                                            text = "确定要将文章移至废纸篓吗？",
                                            confirmText = "移至废纸篓",
                                            isDanger = true,
                                            onConfirm = {
                                                viewModel.deleteDocument(currentDoc.id)
                                                onBack?.invoke()
                                            }
                                        )
                                    }
                                )
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = appBarBg
                )
            )

            // WebView container
            var readingProgress by remember { mutableStateOf(currentDoc.reading_progress) }
            val maxProgressRef = remember { mutableStateOf(currentDoc.reading_progress) }
            // 文档切换时重置进度
            LaunchedEffect(currentDoc.id) {
                readingProgress = currentDoc.reading_progress
                maxProgressRef.value = currentDoc.reading_progress
                // 加载博客（支持所有文章类型的 AI 博客同步与校验）
                viewModel.loadBlog(currentDoc.id)
                if (currentDoc.category == "video") {
                    viewModel.loadSubtitles(currentDoc.id)
                }
            }

            val blogLoading by viewModel.blogLoading.collectAsState()

            val articleContent = @Composable { articleModifier: Modifier, seekCb: ((Float) -> Unit)? ->
                Box(
                    modifier = articleModifier
                ) {
                val contentHtml = if (currentDoc.category == "video" || readingModeTab == "blog") {
                    val markdown = blogContent
                    if (blogLoading) {
                        "<div style='display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh;color:#007aff;font-family:sans-serif;'><div style='width:36px;height:36px;border:3px solid rgba(0,122,255,0.2);border-top-color:#007aff;border-radius:50%;animation:spin 1s linear infinite;'></div><style>@keyframes spin { 100% { transform: rotate(360deg); } }</style><p style='margin-top:16px;font-weight:600;'>✨ AI 博客生成中，请稍候...</p></div>"
                    } else if (!markdown.isNullOrBlank()) {
                        markdownToHtml(markdown)
                    } else {
                        "<div style='display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh;color:#888;font-style:italic;'><p>AI 博客正在生成中，请稍候...</p></div>"
                    }
                } else {
                    currentDoc.html_content ?: "加载中..."
                }

                val pendingQuoteQuery by viewModel.pendingQuoteQuery.collectAsState()

                // Render WebView content
                HtmlContentViewer(
                    html = contentHtml,
                    highlights = highlights,
                    theme = theme,
                    fontFamily = fontFamily,
                    fontSize = fontSize,
                    lineHeight = lineHeight,
                    contentWidth = contentWidth,
                    docId = currentDoc.id,
                    viewModel = viewModel,
                    onWebViewCreated = { webViewRefState = it },
                    onSeekTo = seekCb,
                    onTextSelected = { text, images ->
                        selectedTextForHighlight = text
                        selectedImagesForHighlight = images
                        showHighlightCreator = true
                    },
                    onProgressChanged = { progress ->
                        val max = maxOf(progress, maxProgressRef.value)
                        maxProgressRef.value = max
                        readingProgress = max
                    },
                    initialProgress = currentDoc.reading_progress,
                    isVideo = currentDoc.category == "video",
                    pendingQuoteQuery = if (readingModeTab == "text") pendingQuoteQuery else null,
                    quoteJumpTrigger = quoteJumpTrigger,
                    pendingHighlightToScroll = pendingHighlightToScroll,
                    onExternalLinkClick = { pendingExternalUrl = it }
                )

                // 🎯 安卓端原生 AI 博客交互状态覆盖层 (未生成 / 生成中)
                if ((currentDoc.category == "video" || readingModeTab == "blog") && blogContent.isNullOrBlank()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(MaterialTheme.colorScheme.background)
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (blogLoading) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(40.dp),
                                    color = MaterialTheme.colorScheme.primary,
                                    strokeWidth = 3.dp
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(
                                    text = if (currentDoc.category == "video") "正在调用 AI 生成精选视频博客..." else "正在调用 AI 生成精选文章博客...",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onBackground
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = if (currentDoc.category == "video") "AI 正在梳理原视频字幕、归纳核心要点与嵌入时间戳" else "AI 正在深度解析正文脉络、提炼核心论点与重构结构化精读文章",
                                    fontSize = 12.5.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        } else {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp)
                            ) {
                                Text(
                                    text = if (currentDoc.category == "video") "✨ 暂未生成 AI 视频博客" else "✨ 暂未生成 AI 博客",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onBackground
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    text = if (currentDoc.category == "video") "AI 将把视频字幕整理归纳为带有章节划分与时间戳跳播的 Markdown 结构化博客文章" else "AI 将把文章提炼为结构清晰、带有核心论点总结与原文引用的 Markdown 精读博客",
                                    fontSize = 13.5.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                    lineHeight = 20.sp
                                )
                                Spacer(modifier = Modifier.height(24.dp))
                                Button(
                                    onClick = { viewModel.generateBlogForDocument(currentDoc.id, currentDoc.title) },
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp)
                                ) {
                                    Text(
                                        text = if (currentDoc.category == "video") "✨ 生成 AI 视频博客" else "✨ 生成 AI 博客",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.5.sp
                                    )
                                }
                            }
                        }
                    }
                }



                // 阅读进度条 - 覆盖在 WebView 顶部
                if (currentDoc.html_content != null && currentDoc.html_content != "加载中...") {
                    val progressPercent = (readingProgress * 100).toInt().coerceIn(0, 100)
                    val accentColor = MaterialTheme.colorScheme.primary
                    val completedColor = Color(0xFF22C55E)
                    val isCompleted = progressPercent >= 100

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.TopCenter)
                            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.95f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // 进度条
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(3.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(MaterialTheme.colorScheme.surfaceVariant)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxHeight()
                                        .fillMaxWidth(fraction = readingProgress.coerceIn(0f, 1f))
                                        .clip(RoundedCornerShape(2.dp))
                                        .background(
                                            if (isCompleted) completedColor
                                            else accentColor
                                        )
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            // 百分比文字
                            Text(
                                text = if (isCompleted) "✓ 已读完" else "$progressPercent%",
                                fontSize = 11.sp,
                                color = if (isCompleted) completedColor
                                        else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        // 底部细线分隔
                        Divider(
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                            thickness = 0.5.dp
                        )
                    }
                }

                // Highlight Floating dialog
                if (showHighlightCreator && !selectedTextForHighlight.isNullOrBlank()) {
                    var isCollapsed by remember { mutableStateOf(true) }
                    
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                            .fillMaxWidth()
                            .border(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                    ) {
                        Column(modifier = Modifier.padding(
                            horizontal = if (isCollapsed) 12.dp else 16.dp,
                            vertical = if (isCollapsed) 8.dp else 16.dp
                        )) {
                            if (!isCollapsed) {
                                // === 展开模式 ===
                                // 标题行：含折叠按钮
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("新建高亮", fontWeight = FontWeight.Bold, color = textColor, fontSize = 14.sp)
                                    IconButton(
                                        onClick = { isCollapsed = true },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(
                                            painter = painterResource(id = R.drawable.ic_collapse),
                                            contentDescription = "折叠",
                                            tint = textColor.copy(alpha = 0.5f),
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    "\"${selectedTextForHighlight}\"",
                                    color = textColor.copy(alpha = 0.8f),
                                    maxLines = 3,
                                    overflow = TextOverflow.Ellipsis,
                                    fontSize = 13.sp
                                )
                                Spacer(modifier = Modifier.height(12.dp))

                                // AI actions
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Button(
                                        onClick = {
                                            aiCommandText = selectedTextForHighlight!!
                                            aiCommandType = "translate"
                                            showAiDialog = true
                                            showHighlightCreator = false
                                            selectedTextForHighlight = null
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                        modifier = Modifier.height(28.dp)
                                    ) {
                                        Text("翻译", fontSize = 12.sp, color = MaterialTheme.colorScheme.onPrimary)
                                    }
                                    Button(
                                        onClick = {
                                            aiCommandText = selectedTextForHighlight!!
                                            aiCommandType = "define"
                                            showAiDialog = true
                                            showHighlightCreator = false
                                            selectedTextForHighlight = null
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                        modifier = Modifier.height(28.dp)
                                    ) {
                                        Text("解释", fontSize = 12.sp, color = MaterialTheme.colorScheme.onPrimary)
                                    }
                                    Button(
                                        onClick = {
                                            aiCommandText = selectedTextForHighlight!!
                                            aiCommandType = "simplify"
                                            showAiDialog = true
                                            showHighlightCreator = false
                                            selectedTextForHighlight = null
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                        modifier = Modifier.height(28.dp)
                                    ) {
                                        Text("简化", fontSize = 12.sp, color = MaterialTheme.colorScheme.onPrimary)
                                    }
                                }
                                Spacer(modifier = Modifier.height(12.dp))
                                
                                // Colors and Cancel
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        listOf(
                                            "yellow" to Color(0xFFFDE047),
                                            "green" to Color(0xFF86EFAC),
                                            "blue" to Color(0xFF93C5FD),
                                            "purple" to Color(0xFFC084FC),
                                            "red" to Color(0xFFFCA5A5)
                                        ).forEach { (colorName, colorVal) ->
                                            IconButton(
                                                onClick = {
                                                    viewModel.addHighlight(
                                                        text = selectedTextForHighlight!!,
                                                        color = colorName,
                                                        images = selectedImagesForHighlight,
                                                        isBlogMode = (currentDoc.category == "video" || readingModeTab == "blog")
                                                    )
                                                    showHighlightCreator = false
                                                    selectedTextForHighlight = null
                                                    selectedImagesForHighlight = emptyList()
                                                },
                                                modifier = Modifier
                                                    .size(24.dp)
                                                    .clip(RoundedCornerShape(12.dp))
                                                    .background(colorVal)
                                            ) {}
                                        }
                                    }

                                    TextButton(onClick = {
                                        showHighlightCreator = false
                                        selectedTextForHighlight = null
                                        selectedImagesForHighlight = emptyList()
                                    }) {
                                        Text("取消", color = Color.Gray)
                                    }
                                }
                            } else {
                                // === 折叠模式：紧凑的一行式布局 ===
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    // 颜色选择按钮
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        listOf(
                                            "yellow" to Color(0xFFFDE047),
                                            "green" to Color(0xFF86EFAC),
                                            "blue" to Color(0xFF93C5FD),
                                            "purple" to Color(0xFFC084FC),
                                            "red" to Color(0xFFFCA5A5)
                                        ).forEach { (colorName, colorVal) ->
                                            IconButton(
                                                onClick = {
                                                    viewModel.addHighlight(
                                                        text = selectedTextForHighlight!!,
                                                        color = colorName,
                                                        images = selectedImagesForHighlight,
                                                        isBlogMode = (currentDoc.category == "video" || readingModeTab == "blog")
                                                    )
                                                    showHighlightCreator = false
                                                    selectedTextForHighlight = null
                                                    selectedImagesForHighlight = emptyList()
                                                },
                                                modifier = Modifier
                                                    .size(24.dp)
                                                    .clip(RoundedCornerShape(12.dp))
                                                    .background(colorVal)
                                            ) {}
                                        }
                                    }

                                    // 展开和取消按钮
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(0.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        IconButton(
                                            onClick = { isCollapsed = false },
                                            modifier = Modifier.size(32.dp)
                                        ) {
                                            Icon(
                                                painter = painterResource(id = R.drawable.ic_expand),
                                                contentDescription = "展开",
                                                tint = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }
                                        IconButton(
                                            onClick = {
                                                showHighlightCreator = false
                                                selectedTextForHighlight = null
                                                selectedImagesForHighlight = emptyList()
                                            },
                                            modifier = Modifier.size(32.dp)
                                        ) {
                                            Icon(
                                                painter = painterResource(id = R.drawable.ic_close),
                                                contentDescription = "取消",
                                                tint = Color.Gray,
                                                modifier = Modifier.size(14.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            } // end articleContent

            if (currentDoc.category == "video") {
                // 视频文章：YouTube 播放器 + 切换面板
                androidx.compose.foundation.layout.Box(modifier = Modifier.weight(1f)) {
                    VideoReadingContent(
                        doc = currentDoc,
                        viewModel = viewModel,
                        videoReadingMode = videoReadingMode,
                        articleContent = articleContent,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            } else {
                articleContent(Modifier.fillMaxWidth().weight(1f), null)
            }

            // --- TTS 播放控制条 ---
            AnimatedVisibility(
                visible = ttsState.isActive,
                enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
            ) {
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 4.dp,
                    shadowElevation = 8.dp
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        // 进度条
                        LinearProgressIndicator(
                            progress = ttsState.progress,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(3.dp),
                            color = MaterialTheme.colorScheme.primary,
                            trackColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f),
                        )

                        // 错误信息提示
                        if (ttsState.error != null) {
                            Text(
                                text = ttsState.error!!,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp, vertical = 4.dp),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            // 朗读信息
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    painter = painterResource(id = R.drawable.ic_tts),
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp),
                                    tint = MaterialTheme.colorScheme.primary
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (ttsState.isPlaying) "正在朗读..." else "已暂停",
                                    fontSize = 13.sp,
                                    color = textColor.copy(alpha = 0.7f)
                                )
                                if (ttsState.totalChunks > 0) {
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "${ttsState.currentChunk + 1}/${ttsState.totalChunks}",
                                        fontSize = 11.sp,
                                        color = textColor.copy(alpha = 0.4f)
                                    )
                                }
                            }

                            // 控制按钮组
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(0.dp)
                            ) {
                                // 上一段按钮
                                IconButton(
                                    onClick = { viewModel.previousTtsChunk() },
                                    modifier = Modifier.size(36.dp),
                                    enabled = ttsState.currentChunk > 0
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_skip_previous),
                                        contentDescription = "上一段",
                                        tint = if (ttsState.currentChunk > 0)
                                            MaterialTheme.colorScheme.primary
                                        else
                                            textColor.copy(alpha = 0.2f),
                                        modifier = Modifier.size(20.dp)
                                    )
                                }

                                // 播放/暂停按钮
                                IconButton(
                                    onClick = { viewModel.toggleTts() },
                                    modifier = Modifier.size(40.dp)
                                ) {
                                    Icon(
                                        painter = painterResource(
                                            id = if (ttsState.isPlaying) R.drawable.ic_pause else R.drawable.ic_play
                                        ),
                                        contentDescription = if (ttsState.isPlaying) "暂停" else "播放",
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }

                                // 下一段按钮
                                IconButton(
                                    onClick = { viewModel.nextTtsChunk() },
                                    modifier = Modifier.size(36.dp),
                                    enabled = ttsState.currentChunk < ttsState.totalChunks - 1
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_skip_next),
                                        contentDescription = "下一段",
                                        tint = if (ttsState.currentChunk < ttsState.totalChunks - 1)
                                            MaterialTheme.colorScheme.primary
                                        else
                                            textColor.copy(alpha = 0.2f),
                                        modifier = Modifier.size(20.dp)
                                    )
                                }

                                // 关闭按钮
                                IconButton(
                                    onClick = { viewModel.stopTts() },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_close),
                                        contentDescription = "关闭朗读",
                                        tint = textColor.copy(alpha = 0.5f),
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

        // --- BottomSheet 1: Aa typesetting settings ---
        if (showAaSheet) {
            ModalBottomSheet(
                onDismissRequest = { showAaSheet = false },
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = textColor
            ) {
                AppearanceSettingsContent(
                    viewModel = viewModel,
                    theme = theme,
                    fontSize = fontSize,
                    fontFamily = fontFamily,
                    lineHeight = lineHeight,
                    contentWidth = contentWidth,
                    textColor = textColor
                )
            }
        }

        // --- BottomSheet 2: Notebook Highlights browser ---
        if (showNotebookSheet) {
            ModalBottomSheet(
                onDismissRequest = { showNotebookSheet = false },
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = textColor
            ) {
                NotebookView(viewModel = viewModel)
            }
        }

        // --- BottomSheet 3: AI Assistant Dialogue ---
        if (showAiSheet) {
            ModalBottomSheet(
                onDismissRequest = { showAiSheet = false },
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = textColor
            ) {
                AiAssistantContent(
                    viewModel = viewModel,
                    docId = currentDoc.id,
                    theme = theme,
                    textColor = textColor
                )
            }
        }

        // --- BottomSheet 4: Metadata details ---
        if (showInfoSheet) {
            ModalBottomSheet(
                onDismissRequest = { showInfoSheet = false },
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = textColor
            ) {
                DocumentInfoView(currentDoc)
            }
        }

        // --- BottomSheet 5: Blog Quote Preview BottomSheet ---
        val previewOpen by viewModel.previewBottomSheetOpen.collectAsState()
        val previewQuote by viewModel.previewQuoteText.collectAsState()
        val previewParagraph by viewModel.previewParagraphText.collectAsState()

        if (previewOpen) {
            val scope = rememberCoroutineScope()
            ModalBottomSheet(
                onDismissRequest = { viewModel.closePreviewBottomSheet() },
                containerColor = MaterialTheme.colorScheme.surface,
                scrimColor = Color.Black.copy(alpha = 0.4f)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("🔗 原文段落对比预览", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                            if (!previewQuote.isNullOrBlank()) {
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                                ) {
                                    Text(
                                        "“${previewQuote}”",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.primary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }
                        IconButton(onClick = { viewModel.closePreviewBottomSheet() }) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 280.dp)
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                            .padding(14.dp)
                    ) {
                        Text(
                            text = previewParagraph ?: "未能在正文中精准定位到对应段落。",
                            fontSize = 14.sp,
                            lineHeight = 22.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(onClick = { viewModel.closePreviewBottomSheet() }) {
                            Text("关闭")
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                val rawQuery = viewModel.matchedQuoteQuery.value ?: viewModel.pendingQuoteQuery.value ?: ""
                                viewModel.closePreviewBottomSheet()
                                // 使用 trigger 递增确保 LaunchedEffect 一定重新执行
                                viewModel.setPendingQuoteQuery(rawQuery)
                                quoteJumpTrigger++
                                readingModeTab = "text"
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                        ) {
                            Text("📍 定位跳转至正文该处", color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }

        // AI Command Result Dialog
        if (showAiDialog) {
            var aiResponse by remember { mutableStateOf<String?>(null) }
            var aiError by remember { mutableStateOf<String?>(null) }
            var isLoading by remember { mutableStateOf(true) }

            LaunchedEffect(aiCommandText, aiCommandType) {
                viewModel.executeAiCommand(
                    docId = currentDoc.id,
                    text = aiCommandText,
                    command = aiCommandType,
                    onResponse = {
                        aiResponse = it
                        isLoading = false
                    },
                    onError = {
                        aiError = it
                        isLoading = false
                    }
                )
            }

            AlertDialog(
                onDismissRequest = { showAiDialog = false },
                title = {
                    Text(
                        text = when(aiCommandType) {
                            "translate" -> "AI 翻译"
                            "define" -> "AI 释义"
                            "simplify" -> "AI 简化"
                            else -> "AI 助手"
                        },
                        fontWeight = FontWeight.Bold
                    )
                },
                text = {
                    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                        Text("原文:", color = Color.Gray, fontSize = 12.sp)
                        Text("\"$aiCommandText\"", color = textColor.copy(alpha = 0.8f), fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("AI 回复:", color = Color.Gray, fontSize = 12.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        if (isLoading) {
                            Box(modifier = Modifier.fillMaxWidth().height(80.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator()
                            }
                        } else if (aiError != null) {
                            Text(aiError!!, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
                        } else {
                            Text(aiResponse ?: "暂无回复", color = textColor, fontSize = 14.sp)
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { showAiDialog = false }) {
                        Text("确定")
                    }
                }
            )
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun HtmlContentViewer(
    html: String,
    highlights: List<HighlightEntity>,
    theme: String,
    fontFamily: String,
    fontSize: Int,
    lineHeight: Float,
    contentWidth: Int,
    docId: String,
    viewModel: MainViewModel,
    onTextSelected: (String, List<HighlightImage>) -> Unit,
    onProgressChanged: (Float) -> Unit = {},
    initialProgress: Float = 0f,
    isVideo: Boolean = false,
    onWebViewCreated: (WebView) -> Unit = {},
    onSeekTo: ((Float) -> Unit)? = null,
    pendingQuoteQuery: String? = null,
    quoteJumpTrigger: Int = 0,
    pendingHighlightToScroll: Pair<String, String>? = null,
    onExternalLinkClick: (String) -> Unit = {}
) {
    // 防抖定时器用于延迟持久化进度
    val progressSaveJob = remember { mutableStateOf<Job?>(null) }
    val coroutineScope = rememberCoroutineScope()
    val highlightsJson = highlights.joinToString(separator = ",", prefix = "[", postfix = "]") { hl ->
        val escapedText = hl.text.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "")
        val escapedNote = hl.note?.replace("\\", "\\\\")?.replace("\"", "\\\"")?.replace("\n", "\\n")?.replace("\r", "") ?: ""
        val color = hl.color ?: "yellow"
        val loc = if (isVideo) "null" else hl.location.toString()
        """{"id":"${hl.id}","text":"$escapedText","note":"$escapedNote","color":"$color","location_start":$loc}"""
    }

    val webViewRef = remember { mutableStateOf<WebView?>(null) }
    
    val cleanHtml = if (
        html.trim().equals("undefined", ignoreCase = true) ||
        html.trim().contains("undefined", ignoreCase = true) ||
        html.trim().equals("null", ignoreCase = true) ||
        html.trim().isEmpty() ||
        html == "加载中..."
    ) {
        "<div style='display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh;color:#888;font-style:italic;'><p>内容正在加载中...</p></div>"
    } else {
        html
            .replace(Regex("<script[^>]*>.*?</script>", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)), "")
            .replace(Regex("<style[^>]*>.*?</style>", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)), "")
            .replace(Regex("<head[^>]*>.*?</head>", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)), "")
            .replace(Regex("<!DOCTYPE[^>]*>", setOf(RegexOption.IGNORE_CASE)), "")
            .replace(Regex("</?html[^>]*>", setOf(RegexOption.IGNORE_CASE)), "")
            .replace(Regex("</?body[^>]*>", setOf(RegexOption.IGNORE_CASE)), "")
    }

    val lastLoadedKey = remember { mutableStateOf("") }
    val currentKey = "${docId}_${cleanHtml.hashCode()}_${theme}_${fontFamily}_${fontSize}_${lineHeight}_${contentWidth}"
    val pageReady = remember { mutableStateOf(false) }

    LaunchedEffect(pendingHighlightToScroll, pageReady.value, lastLoadedKey.value) {
        val pending = pendingHighlightToScroll
        if (pending != null && pageReady.value && lastLoadedKey.value == currentKey) {
            val hlStr = org.json.JSONObject.quote(pending.first)
            val textStr = org.json.JSONObject.quote(pending.second)
            val js = "if (typeof window.scrollToHighlight === 'function') { window.scrollToHighlight($hlStr, $textStr); }"
            webViewRef.value?.evaluateJavascript(js, null)
        }
    }

    LaunchedEffect(pendingQuoteQuery, pageReady.value, lastLoadedKey.value, quoteJumpTrigger) {
        if (!pendingQuoteQuery.isNullOrBlank()) {
            if (!pageReady.value || lastLoadedKey.value != currentKey) {
                var waited = 0
                while ((!pageReady.value || lastLoadedKey.value != currentKey) && waited < 5000) {
                    kotlinx.coroutines.delay(100)
                    waited += 100
                }
                if (!pageReady.value || lastLoadedKey.value != currentKey) {
                    return@LaunchedEffect
                }
            }
            val query = pendingQuoteQuery
            val hintRaw = viewModel.previewParagraphText.value
            val qStr = org.json.JSONObject.quote(query)
            val pStr = org.json.JSONObject.quote(hintRaw?.take(150) ?: "")

            val jsCode = """
                (function() {
                    try {
                        var rawQuote = $qStr;
                        var hintText = $pStr;
                        var candidates = [];
                        if (rawQuote) {
                            var cleanRaw = rawQuote;
                            try { cleanRaw = decodeURIComponent(rawQuote); } catch(e) {}
                            cleanRaw = cleanRaw.replace(/^#quote-/, '').replace(/^["“'”\s]+|["“'”\s]+$/g, '').trim();
                            if (cleanRaw.length >= 2) candidates.push(cleanRaw);
                        }
                        if (hintText) {
                            var cleanHint = hintText.replace(/^["“'”\s]+|["“'”\s]+$/g, '').trim();
                            if (cleanHint.length >= 2 && candidates.indexOf(cleanHint) === -1) candidates.push(cleanHint);
                        }
                        if (candidates.length === 0) return;

                        var target = null;

                        // 1. Direct ID / Anchor match
                        if (rawQuote) {
                            var idClean = rawQuote.replace(/^#/, '');
                            target = document.getElementById(idClean) ||
                                     document.querySelector('[name="' + idClean + '"]') ||
                                     document.querySelector('[data-quote*="' + candidates[0] + '"]');
                        }

                        // 2. DOM text element search (depth-first / leaf-preferring)
                        if (!target) {
                            var allElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, dt, dd, td, th, span, div, section, article'));
                            var validElements = allElements.filter(function(el) {
                                if (el === document.body || el === document.documentElement) return false;
                                // Ignore container elements that have more than 3 block children
                                var blockChildCount = el.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, section, article, div').length;
                                return blockChildCount <= 3;
                            });

                            // Sort by DOM depth descending so we inspect leaf elements first before container parents
                            validElements.sort(function(a, b) {
                                var dA = 0, dB = 0, pA = a, pB = b;
                                while (pA) { dA++; pA = pA.parentElement; }
                                while (pB) { dB++; pB = pB.parentElement; }
                                return dB - dA;
                            });

                            for (var c = 0; c < candidates.length && !target; c++) {
                                var queryStr = candidates[c];
                                for (var i = 0; i < validElements.length; i++) {
                                    var el = validElements[i];
                                    var txt = (el.innerText || el.textContent || '').trim();
                                    if (!txt) continue;

                                    // Check 1: Element text contains the candidate query
                                    if (txt.indexOf(queryStr) !== -1) {
                                        target = el;
                                        break;
                                    }
                                    // Check 2: Candidate query contains element text ONLY if element text is long enough (>= 10 chars)
                                    if (txt.length >= 10 && queryStr.indexOf(txt) !== -1) {
                                        target = el;
                                        break;
                                    }
                                }
                            }

                            // 3. Fallback: Word/Chunk substring matching
                            if (!target) {
                                for (var c2 = 0; c2 < candidates.length && !target; c2++) {
                                    var str = candidates[c2];
                                    var subKeys = [];
                                    if (str.length >= 6) {
                                        subKeys.push(str.substring(0, Math.min(15, str.length)));
                                        if (str.length >= 20) {
                                            var mid = Math.floor(str.length / 2);
                                            subKeys.push(str.substring(mid - 7, mid + 8));
                                        }
                                    }

                                    for (var k = 0; k < subKeys.length && !target; k++) {
                                        var key = subKeys[k].trim();
                                        if (key.length < 4) continue;
                                        for (var j = 0; j < validElements.length; j++) {
                                            var el2 = validElements[j];
                                            var txt2 = (el2.innerText || el2.textContent || '').trim();
                                            if (txt2.length >= 4 && txt2.indexOf(key) !== -1) {
                                                target = el2;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if (target) {
                            var scrollToTarget = function(reason) {
                                try {
                                    var rect = target.getBoundingClientRect();
                                    var currentScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
                                    var targetY = rect.top + currentScrollTop - (window.innerHeight / 3);
                                    var finalY = Math.max(0, Math.round(targetY));
                                    window.scrollTo(0, finalY);
                                } catch(e) {}
                            };

                            // 1. Immediate scroll
                            scrollToTarget('immediate');

                            // 2. Retry at 300ms to handle initial layout shifts
                            setTimeout(function() { scrollToTarget('300ms-retry'); }, 300);

                            // 3. Retry at 800ms to handle late image loads
                            setTimeout(function() { scrollToTarget('800ms-retry'); }, 800);

                            // Highlight element background
                            var origBg = target.style.backgroundColor;
                            var origTrans = target.style.transition;
                            target.style.transition = 'background-color 0.4s ease';
                            target.style.backgroundColor = 'rgba(255, 215, 0, 0.45)';
                            target.style.borderRadius = '6px';
                            setTimeout(function() {
                                target.style.backgroundColor = origBg || '';
                                target.style.transition = origTrans || '';
                            }, 3500);

                            // Inform Kotlin layer after 1500ms so pending state settles
                            setTimeout(function() {
                                if (window.AndroidBridge && typeof window.AndroidBridge.onQuoteLocated === 'function') {
                                    window.AndroidBridge.onQuoteLocated();
                                }
                            }, 1500);
                        }
                    } catch(e) {}
                })();
            """.trimIndent()

            kotlinx.coroutines.delay(200)
            webViewRef.value?.evaluateJavascript(jsCode, null)
            kotlinx.coroutines.delay(2000)
            if (viewModel.pendingQuoteQuery.value == query) {
                viewModel.setPendingQuoteQuery(null)
            }
        }
    }

    AndroidView(
        factory = { context ->
            WebView(context).apply {
                webViewRef.value = this
                onWebViewCreated(this)
                
                webChromeClient = object : android.webkit.WebChromeClient() {}
                
                webViewClient = object : android.webkit.WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        // pageReady 改由 JS 端通过 AndroidBridge.onPageReady() 在
                        // window.originalHtml 初始化完毕后再设置，避免竞态
                    }
                }
                
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                
                // 将 WebView 背景色设为透明，使其无缝继承 Compose 底色，防止切换主题或加载时发生闪烁
                setBackgroundColor(android.graphics.Color.TRANSPARENT)
                
                // 原生滚动阻尼参数：降低 WebView 滚动惯性，配合 JS 层减速逻辑
                overScrollMode = android.view.View.OVER_SCROLL_NEVER
                isVerticalScrollBarEnabled = true
                scrollBarFadeDuration = 300
                
                // 显式关闭 Android 9+ 在系统深色模式下对 WebView 的强制变暗处理，完全交由我们的 CSS 控制
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    @Suppress("DEPRECATION")
                    settings.forceDark = android.webkit.WebSettings.FORCE_DARK_OFF
                }
                
                // 解决 Android 13 (API 33) 及以上在系统深色模式下自动进行算法变暗从而覆盖网页浅色背景的问题
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                    settings.isAlgorithmicDarkeningAllowed = false
                }

                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView?, request: android.webkit.WebResourceRequest?): Boolean {
                        val urlStr = request?.url?.toString() ?: ""
                        if (urlStr.startsWith("seekto:")) {
                            val secs = urlStr.removePrefix("seekto:").toFloatOrNull() ?: 0f
                            viewModel.seekVideoTo(secs)
                            onSeekTo?.invoke(secs)
                            return true
                        } else if (urlStr.contains("#quote-") || urlStr.startsWith("quote:")) {
                            val rawQuery = urlStr.substringAfter("#quote-").substringAfter("quote:")
                            val query = try { java.net.URLDecoder.decode(rawQuery, "UTF-8") } catch (e: Exception) { rawQuery }
                            viewModel.onBlogQuoteClick(query, viewModel.selectedDoc.value)
                            return true
                        } else if (urlStr.startsWith("http://") || urlStr.startsWith("https://") || urlStr.startsWith("mailto:") || urlStr.startsWith("tel:")) {
                            onExternalLinkClick(urlStr)
                            return true
                        } else if (urlStr.startsWith("#")) {
                            return false
                        }
                        return true
                    }

                    @Deprecated("Deprecated in Java")
                    override fun shouldOverrideUrlLoading(view: WebView?, urlStr: String?): Boolean {
                        if (urlStr != null) {
                            if (urlStr.startsWith("seekto:")) {
                                val secs = urlStr.removePrefix("seekto:").toFloatOrNull() ?: 0f
                                viewModel.seekVideoTo(secs)
                                onSeekTo?.invoke(secs)
                                return true
                            } else if (urlStr.contains("#quote-") || urlStr.startsWith("quote:")) {
                                val rawQuery = urlStr.substringAfter("#quote-").substringAfter("quote:")
                                val query = try { java.net.URLDecoder.decode(rawQuery, "UTF-8") } catch (e: Exception) { rawQuery }
                                viewModel.onBlogQuoteClick(query, viewModel.selectedDoc.value)
                                return true
                            } else if (urlStr.startsWith("http://") || urlStr.startsWith("https://") || urlStr.startsWith("mailto:") || urlStr.startsWith("tel:")) {
                                onExternalLinkClick(urlStr)
                                return true
                            } else if (urlStr.startsWith("#")) {
                                return false
                            }
                        }
                        return true
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        // 后备机制：如果 JS 端的 onPageReady() 没有执行（比如脚本异常），
                        // 在 onPageFinished 后延迟 500ms 强制设置 pageReady=true
                        view?.postDelayed({
                            if (!pageReady.value) {
                                pageReady.value = true
                            }
                        }, 500)
                        view?.loadUrl(
                            "javascript:(function() { " +
                                    "if (window.__initSelectionSystem) { window.__initSelectionSystem(); } " +
                                    "})()"
                        )
                    }
                }
                
                addJavascriptInterface(object {
                    @JavascriptInterface
                    fun onTextSelected(text: String, imagesJson: String) {
                        post {
                            val images = try {
                                Json.decodeFromString<List<HighlightImage>>(imagesJson)
                            } catch (e: Exception) {
                                emptyList()
                            }
                            onTextSelected(text, images)
                        }
                    }

                    @JavascriptInterface
                    fun onHighlightClicked(hlId: String) {
                        post {
                            viewModel.onHighlightClickedFromWeb(hlId)
                        }
                    }

                    @JavascriptInterface
                    fun onPageReady() {
                        post {
                            pageReady.value = true
                        }
                    }

                    @JavascriptInterface
                    fun seekTo(seconds: Float) {
                        post {
                            viewModel.seekVideoTo(seconds)
                            onSeekTo?.invoke(seconds)
                        }
                    }

                    @JavascriptInterface
                    fun onScrollProgress(progress: Float) {
                        post {
                            onProgressChanged(progress)
                            // 防抖 2 秒后持久化进度
                            progressSaveJob.value?.cancel()
                            progressSaveJob.value = coroutineScope.launch {
                                kotlinx.coroutines.delay(2000)
                                viewModel.updateReadingProgress(docId, progress)
                            }
                        }
                    }

                    @JavascriptInterface
                    fun onHighlightPositions(positionsJson: String) {
                        post {
                            try {
                                val posMap = Json.decodeFromString<Map<String, Int>>(positionsJson)
                                viewModel.updateHighlightPositions(posMap)
                            } catch (e: Exception) {
                                // 忽略解析错误
                            }
                        }
                    }

                    @JavascriptInterface
                    fun onQuoteClick(quoteQuery: String) {
                        post {
                            val doc = viewModel.selectedDoc.value
                            viewModel.onBlogQuoteClick(quoteQuery, doc)
                        }
                    }

                    @JavascriptInterface
                    fun onQuoteLocated() {
                        post {
                            viewModel.setPendingQuoteQuery(null)
                        }
                    }

                    @JavascriptInterface
                    fun onRegenerateBlog() {
                        post {
                            val doc = viewModel.selectedDoc.value
                            if (doc != null) {
                                viewModel.generateBlogForDocument(doc.id, doc.title)
                            }
                        }
                    }

                    @JavascriptInterface
                    fun onExternalLinkClick(url: String) {
                        post {
                            onExternalLinkClick(url)
                        }
                    }
                }, "AndroidBridge")
            }
        },
        update = { webView ->
            val styledHtml = """
                <html>
                <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
                <style>
                    html, body {
                        background-color: ${if (theme == "dark") "#121212" else if (theme == "sepia") "#F4F1EB" else "#FCFCFA"} !important;
                        color: ${if (theme == "dark") "#E5E7EB" else if (theme == "sepia") "#2B251F" else "#1A1A1A"} !important;
                    }
                    body {
                        font-family: ${if (fontFamily == "serif") "Georgia, Cambria, 'Times New Roman', Times, serif" else "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"};
                        line-height: $lineHeight;
                        font-size: ${fontSize}px;
                        max-width: ${contentWidth}px;
                        margin: 0 auto;
                        padding: 20px 20px 240px 20px;
                    }
                    a { color: #6366F1; text-decoration: none; }
                    img { max-width: 100%; height: auto; border-radius: 4px; margin: 16px 0; }
                    blockquote { border-left: 4px solid #8B5E3C; padding-left: 12px; color: #70655B; margin: 16px 0; font-style: italic; }
                    pre, code { background-color: ${if (theme == "dark") "#1F2937" else if (theme == "sepia") "#EAE5DA" else "#F3F4F6"}; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px; }
                    
                    /* 高亮背景色及前景色，优先级最高 */
                    .highlight-color.yellow { background-color: #fef08a !important; color: #1a1a1a !important; }
                    .highlight-color.green { background-color: #bbf7d0 !important; color: #1a1a1a !important; }
                    .highlight-color.blue { background-color: #bfdbfe !important; color: #1a1a1a !important; }
                    .highlight-color.purple { background-color: #ddd6fe !important; color: #1a1a1a !important; }
                    .highlight-color.red { background-color: #fecaca !important; color: #1a1a1a !important; }

                    /* TTS 朗读高亮样式 */
                    .tts-active-chunk {
                        background-color: ${if (theme == "dark") "rgba(99, 102, 241, 0.2)" else if (theme == "sepia") "rgba(139, 94, 60, 0.12)" else "rgba(99, 102, 241, 0.1)"} !important;
                        border-left: 3px solid ${if (theme == "dark") "#818CF8" else if (theme == "sepia") "#8B5E3C" else "#6366F1"} !important;
                        padding-left: 12px !important;
                        border-radius: 4px;
                        transition: background-color 0.3s ease, border-left 0.3s ease;
                    }

                    /* 点选高亮模式 HUD 横幅与浮标 */
                    #picker-hud-banner {
                        position: fixed;
                        top: 12px;
                        left: 50%;
                        transform: translateX(-50%);
                        z-index: 9999;
                        background: ${if (theme == "dark") "#1E293B" else "#FFFFFF"};
                        color: ${if (theme == "dark") "#F8FAFC" else "#0F172A"};
                        border: 1.5px solid #6366F1;
                        border-radius: 20px;
                        padding: 8px 16px;
                        font-size: 13px;
                        box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
                        display: none !important;
                        align-items: center;
                        gap: 12px;
                    }
                    #picker-start-marker {
                        position: fixed;
                        z-index: 9998;
                        background-color: #6366F1;
                        color: #ffffff;
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: bold;
                        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
                        display: none !important;
                        pointer-events: none;
                    }
                    #picker-end-marker {
                        position: fixed;
                        z-index: 9998;
                        background-color: #10B981;
                        color: #ffffff;
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: bold;
                        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
                        display: none !important;
                        pointer-events: none;
                    }
                </style>
                </head>
                <body>
                    <!-- 顶部 HUD 横幅与起点/终点标识 (默认隐藏) -->
                    <div id="picker-hud-banner">
                        <span id="picker-hud-text">🎯 <strong>点选模式已开启</strong>：请点击【起点】</span>
                    </div>
                    <div id="picker-start-marker">📍 起点</div>
                    <div id="picker-end-marker">📍 终点</div>
                    <div style="height: 32px;"></div>
                    $cleanHtml
                    
                    <script>
                        window.isPickerMode = false;
                        window.pickerStart = null;
                        window.__selectionSystemInitialized = false;

                        function resolveTextNodeAndOffset(node, offset) {
                            if (!node) return null;
                            if (node.nodeType === Node.TEXT_NODE) {
                                return { node: node, offset: Math.min(Math.max(0, offset), node.textContent.length) };
                            }
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.childNodes && node.childNodes.length > 0) {
                                    var idx = Math.min(Math.max(0, offset), node.childNodes.length - 1);
                                    var targetChild = node.childNodes[idx];
                                    if (targetChild) {
                                        if (targetChild.nodeType === Node.TEXT_NODE) {
                                            return { node: targetChild, offset: 0 };
                                        }
                                        var walker = document.createTreeWalker(targetChild, NodeFilter.SHOW_TEXT, null, false);
                                        var text = walker.nextNode();
                                        if (text) return { node: text, offset: 0 };
                                    }
                                }
                            }
                            return { node: node, offset: offset };
                        }

                        function getAccurateSelectionRange(sel) {
                            if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
                            
                            var anchorNode = sel.anchorNode;
                            var anchorOffset = sel.anchorOffset;
                            var focusNode = sel.focusNode;
                            var focusOffset = sel.focusOffset;
                            
                            if (!anchorNode || !focusNode) {
                                try { return sel.getRangeAt(0); } catch(e) { return null; }
                            }
                            
                            // 同一文本节点快速计算
                            if (anchorNode === focusNode) {
                                var r = document.createRange();
                                var start = Math.min(anchorOffset, focusOffset);
                                var end = Math.max(anchorOffset, focusOffset);
                                r.setStart(anchorNode, start);
                                r.setEnd(anchorNode, end);
                                return r;
                            }
                            
                            var pos = anchorNode.compareDocumentPosition(focusNode);
                            var isForward = (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
                            
                            var rawStartNode = isForward ? anchorNode : focusNode;
                            var rawStartOffset = isForward ? anchorOffset : focusOffset;
                            var rawEndNode = isForward ? focusNode : anchorNode;
                            var rawEndOffset = isForward ? focusOffset : anchorOffset;
                            
                            var startResolved = resolveTextNodeAndOffset(rawStartNode, rawStartOffset) || { node: rawStartNode, offset: rawStartOffset };
                            var endResolved = resolveTextNodeAndOffset(rawEndNode, rawEndOffset) || { node: rawEndNode, offset: rawEndOffset };
                            
                            try {
                                var range = document.createRange();
                                range.setStart(startResolved.node, startResolved.offset);
                                range.setEnd(endResolved.node, endResolved.offset);
                                return range;
                            } catch (err) {
                                try {
                                    return sel.getRangeAt(0);
                                } catch (e2) {
                                    return null;
                                }
                            }
                        }

                        window.__initSelectionSystem = function() {
                            if (window.__selectionSystemInitialized) return;
                            window.__selectionSystemInitialized = true;
                            
                            var _selScrollThrottled = false;
                            var _selScrollMAX = 30;
                            var _selReportTimeout = null;

                            function handleSelectionUpdate() {
                                if (window.isPickerMode) return;
                                var sel = window.getSelection();
                                if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
                                
                                var range = getAccurateSelectionRange(sel);
                                if (!range) return;
                                
                                var text = extractSelectionText(range);
                                var images = extractImagesFromRange(range);
                                
                                if (text.trim().length > 0 || images.length > 0) {
                                    AndroidBridge.onTextSelected(text, JSON.stringify(images));
                                }
                            }

                            document.addEventListener('selectionchange', function() {
                                if (window.isPickerMode) return;
                                var sel = window.getSelection();
                                if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
                                
                                var range = getAccurateSelectionRange(sel);
                                if (!range) return;
                                
                                // 防抖 120ms 上报，过滤拖动/出屏过程中的瞬时脏状态
                                clearTimeout(_selReportTimeout);
                                _selReportTimeout = setTimeout(function() {
                                    handleSelectionUpdate();
                                }, 120);
                                
                                // 阻尼自动滚动系统
                                try {
                                    var rect = range.getBoundingClientRect();
                                    var viewportHeight = window.innerHeight;
                                    var triggerThreshold = viewportHeight - 240;
                                    if (rect.bottom > triggerThreshold && !_selScrollThrottled) {
                                        _selScrollThrottled = true;
                                        requestAnimationFrame(function() {
                                            _selScrollThrottled = false;
                                            var rawDelta = rect.bottom - triggerThreshold;
                                            var dampedDelta = Math.sqrt(rawDelta) * 3;
                                            var finalScroll = Math.min(dampedDelta, _selScrollMAX);
                                            window.scrollBy({ top: finalScroll, behavior: 'auto' });
                                        });
                                    }
                                } catch (err) {}
                            });

                            document.addEventListener('touchend', function() {
                                if (window.isPickerMode) return;
                                clearTimeout(_selReportTimeout);
                                setTimeout(function() {
                                    handleSelectionUpdate();
                                }, 80);
                            }, true);
                        };

                        // 立即尝试启动选区系统
                        window.__initSelectionSystem();

                        window.setPickerMode = function(enabled) {
                            window.isPickerMode = enabled;
                            window.pickerStart = null;
                            var banner = document.getElementById('picker-hud-banner');
                            if (banner) banner.style.setProperty('display', enabled ? 'flex' : 'none', 'important');
                            var startMarker = document.getElementById('picker-start-marker');
                            if (startMarker) startMarker.style.setProperty('display', 'none', 'important');
                            var endMarker = document.getElementById('picker-end-marker');
                            if (endMarker) endMarker.style.setProperty('display', 'none', 'important');
                            if (!enabled && window.getSelection) {
                                window.getSelection().removeAllRanges();
                            }
                        };

                        function getCaretPointFromEvent(e) {
                            var clientX = e.clientX;
                            var clientY = e.clientY;
                            if (e.changedTouches && e.changedTouches.length > 0) {
                                clientX = e.changedTouches[0].clientX;
                                clientY = e.changedTouches[0].clientY;
                            } else if (e.touches && e.touches.length > 0) {
                                clientX = e.touches[0].clientX;
                                clientY = e.touches[0].clientY;
                            }
                            if (clientX === undefined || clientY === undefined) return null;
                            var range = null;
                            if (document.caretRangeFromPoint) {
                                range = document.caretRangeFromPoint(clientX, clientY);
                            } else if (document.caretPositionFromPoint) {
                                var pos = document.caretPositionFromPoint(clientX, clientY);
                                if (pos) {
                                    range = document.createRange();
                                    range.setStart(pos.offsetNode, pos.offset);
                                    range.collapse(true);
                                }
                            }
                            return range;
                        }

                        function handlePickerTrigger(e) {
                            if (!window.isPickerMode) return;
                            if (e) {
                                e.preventDefault();
                                e.stopPropagation();
                            }
                            if (e.target.closest('#picker-hud-banner')) return;

                            var caretRange = getCaretPointFromEvent(e);
                            if (!caretRange) return;

                            var rawResolved = resolveTextNodeAndOffset(caretRange.startContainer, caretRange.startOffset);
                            var resolvedNode = rawResolved ? rawResolved.node : caretRange.startContainer;
                            var resolvedOffset = rawResolved ? rawResolved.offset : caretRange.startOffset;

                            if (!window.pickerStart) {
                                var text = (resolvedNode.textContent || '').substring(resolvedOffset, resolvedOffset + 12) || '起点';
                                window.pickerStart = {
                                    node: resolvedNode,
                                    offset: resolvedOffset
                                };
                                var hudText = document.getElementById('picker-hud-text');
                                if (hudText) hudText.innerHTML = '📍 <strong>起点已锁定</strong> (“' + text.trim() + '”)：请点击【终点】';
                                var startMarker = document.getElementById('picker-start-marker');
                                if (startMarker) {
                                    var rect = caretRange.getBoundingClientRect();
                                    startMarker.style.top = Math.max(10, rect.top - 28) + 'px';
                                    startMarker.style.left = Math.max(10, rect.left - 10) + 'px';
                                    startMarker.style.setProperty('display', 'block', 'important');
                                }
                                var endMarker = document.getElementById('picker-end-marker');
                                if (endMarker) endMarker.style.setProperty('display', 'none', 'important');
                                setTimeout(function() {
                                    if (window.getSelection) window.getSelection().removeAllRanges();
                                }, 50);
                            } else {
                                var startNode = window.pickerStart.node;
                                var startOffset = window.pickerStart.offset;
                                var endNode = resolvedNode;
                                var endOffset = resolvedOffset;

                                var finalRange = document.createRange();
                                var pos = startNode.compareDocumentPosition(endNode);
                                var isStartBefore = (startNode === endNode && startOffset <= endOffset) || (pos & Node.DOCUMENT_POSITION_FOLLOWING);

                                if (isStartBefore) {
                                    finalRange.setStart(startNode, startOffset);
                                    finalRange.setEnd(endNode, endOffset);
                                } else {
                                    finalRange.setStart(endNode, endOffset);
                                    finalRange.setEnd(startNode, startOffset);
                                }

                                var endMarker = document.getElementById('picker-end-marker');
                                if (endMarker) {
                                    var endRect = caretRange.getBoundingClientRect();
                                    endMarker.style.top = Math.max(10, endRect.top - 28) + 'px';
                                    endMarker.style.left = Math.max(10, endRect.left - 10) + 'px';
                                    endMarker.style.setProperty('display', 'block', 'important');
                                }

                                // 🎯 高亮视觉选区呈现：在选区范围内呈现标准亮蓝高亮选区背景！
                                if (window.getSelection) {
                                    var sel = window.getSelection();
                                    sel.removeAllRanges();
                                    sel.addRange(finalRange);
                                }

                                var selText = extractSelectionText(finalRange);
                                var selImages = extractImagesFromRange(finalRange);

                                if (selText.trim().length > 0 || selImages.length > 0) {
                                    AndroidBridge.onTextSelected(selText, JSON.stringify(selImages));
                                }

                                window.pickerStart = null;
                                var hudText = document.getElementById('picker-hud-text');
                                if (hudText) hudText.innerHTML = '🎯 <strong>点选选区已生效</strong>：请选择颜色或划线功能';
                            }
                        }

                        var touchStartX = 0;
                        var touchStartY = 0;
                        var isTouchMoved = false;

                        document.addEventListener('touchstart', function(e) {
                            if (!window.isPickerMode) return;
                            if (e.touches && e.touches.length > 0) {
                                touchStartX = e.touches[0].clientX;
                                touchStartY = e.touches[0].clientY;
                                isTouchMoved = false;
                            }
                        }, true);

                        document.addEventListener('touchmove', function(e) {
                            if (!window.isPickerMode) return;
                            if (e.touches && e.touches.length > 0) {
                                var moveX = Math.abs(e.touches[0].clientX - touchStartX);
                                var moveY = Math.abs(e.touches[0].clientY - touchStartY);
                                if (moveX > 8 || moveY > 8) {
                                    isTouchMoved = true;
                                }
                            }
                        }, true);

                        var lastTouchTime = 0;
                        document.addEventListener('touchend', function(e) {
                            if (!window.isPickerMode) return;
                            lastTouchTime = Date.now();
                            if (isTouchMoved) {
                                return;
                            }
                            handlePickerTrigger(e);
                        }, true);

                        document.addEventListener('click', function(e) {
                            if (!window.isPickerMode) return;
                            e.preventDefault();
                            e.stopPropagation();
                            if (Date.now() - lastTouchTime < 500) return; // 过滤触摸后的重复 click
                            if (isTouchMoved) return;
                            handlePickerTrigger(e);
                        }, true);

                        function extractImagesFromRange(range) {
                          if (!range) return [];
                          var fragment;
                          try {
                            fragment = range.cloneContents();
                          } catch (e) {
                            return [];
                          }
                          const images = [];
                          const imgElements = fragment.querySelectorAll('img');
                          imgElements.forEach(img => {
                            const src = img.getAttribute('src') || img.src || '';
                            if (src) {
                              images.push({
                                src: src,
                                alt: img.getAttribute('alt') || '图片'
                              });
                            }
                          });
                          return images;
                        }

                        function extractSelectionText(range) {
                          if (!range) return '';
                          const BLOCK_ELEMENTS = new Set([
                            'P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                            'BR', 'HR', 'BLOCKQUOTE', 'PRE', 'TR', 'DT', 'DD',
                            'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE', 'FIGCAPTION', 'TABLE'
                          ]);
                          
                          let fragment;
                          try {
                            fragment = range.cloneContents();
                          } catch (e) {
                            return (range.toString() || '').trim();
                          }
                          
                          const parts = [];
                          
                          function walk(node, olCounter, inPre) {
                            if (node.nodeType === Node.TEXT_NODE) {
                              parts.push(node.textContent);
                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                              const tagName = node.tagName;
                              const isPre = inPre || tagName === 'PRE' || tagName === 'CODE';
                              
                              if (tagName === 'BR') {
                                parts.push('\n');
                                return;
                              }
                              if (tagName === 'IMG') {
                                const alt = node.getAttribute('alt') || '图片';
                                const src = node.getAttribute('src') || node.src || '';
                                if (src && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:'))) {
                                  parts.push('\n\n![' + alt + '](' + src + ')\n\n');
                                } else {
                                  parts.push('[图片: ' + alt + ']');
                                }
                                return;
                              }
                              if (tagName === 'TD' || tagName === 'TH') {
                                if (parts.length > 0 && !parts[parts.length - 1].endsWith(' ') && !parts[parts.length - 1].endsWith('\n')) {
                                  parts.push(' ');
                                }
                              }
                              const isBlock = BLOCK_ELEMENTS.has(tagName);
                              if (isBlock && parts.length > 0 && parts[parts.length - 1] !== '\n') {
                                parts.push('\n');
                              }
                              if (tagName === 'LI') {
                                if (olCounter) {
                                  parts.push(olCounter.value++ + '. ');
                                } else {
                                  parts.push('• ');
                                }
                              }
                              const childCounter = (tagName === 'OL') ? { value: 1 } : olCounter;
                              for (let i = 0; i < node.childNodes.length; i++) {
                                walk(node.childNodes[i], childCounter, isPre);
                              }
                              if (isBlock && parts.length > 0 && parts[parts.length - 1] !== '\n') {
                                parts.push('\n');
                              }
                            }
                          }
                          
                          for (let i = 0; i < fragment.childNodes.length; i++) {
                            walk(fragment.childNodes[i], null, false);
                          }
                          return parts.join('').trim();
                        }

                        function getTextOffset(root, node, offset) {
                          let currentOffset = 0;
                          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
                          let currentNode = walker.nextNode();
                          while (currentNode) {
                            if (currentNode === node) {
                              return currentOffset + offset;
                            }
                            currentOffset += currentNode.textContent.length;
                            currentNode = walker.nextNode();
                          }
                          return -1;
                        }

                        function getNodeAndOffsetAt(root, targetOffset) {
                          let currentOffset = 0;
                          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
                          let currentNode = walker.nextNode();
                          while (currentNode) {
                            const nodeLength = currentNode.textContent.length;
                            if (currentOffset + nodeLength >= targetOffset || (currentOffset + nodeLength === targetOffset && !walker.nextNode())) {
                              return { node: currentNode, offset: targetOffset - currentOffset };
                            }
                            currentOffset += nodeLength;
                            currentNode = walker.nextNode();
                          }
                          return null;
                        }

                        function findFuzzyOffset(fullText, query) {
                          if (!query) return null;
                          let cleanQuery = query.replace(/!\[[\s\S]*?\]\([\s\S]*?\)/g, '');
                          cleanQuery = cleanQuery.replace(/\[([^\]]*?)\]\([\s\S]*?\)/g, '${'$'}1');
                          cleanQuery = cleanQuery.replace(/\[图片:\s*[^\]]*?\]/g, '');
                          cleanQuery = cleanQuery.replace(/^\s*\d+\.\s+/gm, '');
                          cleanQuery = cleanQuery.replace(/\n{2,}/g, '\n').trim();

                          const exact = fullText.indexOf(cleanQuery);
                          if (exact !== -1) return { start: exact, end: exact + cleanQuery.length };

                          const queryTokens = cleanQuery.trim().split(/\s+/);
                          if (queryTokens.length === 0) return null;
                          const escapeRegExp = (string) => string.replace(/[.*+?^${'$'}{}()|[\]\\]/g, '\\${'$'}&');
                          const pattern = queryTokens.map(escapeRegExp).join('\\s*');
                          try {
                            const regex = new RegExp(pattern, 'i');
                            const match = fullText.match(regex);
                            if (match && match.index != null) {
                              return { start: match.index, end: match.index + match[0].length };
                            }
                          } catch (e) {}

                          const strippedQuery = cleanQuery.replace(/(\*\*|\*|__|_|#|`|>)/g, '');
                          if (strippedQuery !== cleanQuery && strippedQuery.trim().length > 0) {
                            const strippedTokens = strippedQuery.trim().split(/\s+/);
                            const pattern2 = strippedTokens.map(escapeRegExp).join('\\s*');
                            try {
                              const regex2 = new RegExp(pattern2, 'i');
                              const match2 = fullText.match(regex2);
                              if (match2 && match2.index != null) {
                                return { start: match2.index, end: match2.index + match2[0].length };
                              }
                            } catch (e) {}
                          }

                          const isWordChar = (char) => !/[\s\p{P}\p{S}]/u.test(char);
                          const strippedFull = [];
                          const mapFull = [];
                          for (let i = 0; i < fullText.length; i++) {
                            if (isWordChar(fullText[i])) {
                              strippedFull.push(fullText[i]);
                              mapFull.push(i);
                            }
                          }
                          const strippedQueryStr = Array.from(strippedQuery).filter(isWordChar).join('');
                          const strippedFullStr = strippedFull.join('');
                          if (strippedQueryStr.length > 0) {
                            const matchIndex = strippedFullStr.indexOf(strippedQueryStr);
                            if (matchIndex !== -1) {
                              const originalStart = mapFull[matchIndex];
                              const originalEnd = mapFull[matchIndex + strippedQueryStr.length - 1] + 1;
                              return { start: originalStart, end: originalEnd };
                            }
                          }
                          return null;
                        }
                        function findFuzzyOffsetsForBlock(fullText, query) {
                          if (!query || !fullText) return [];
                          const singleMatch = findFuzzyOffset(fullText, query);
                          if (singleMatch) return [singleMatch];
                          const lines = query.split(/[\n\r]+/).map(s => s.trim()).filter(Boolean);
                          const results = [];
                          const seenRanges = new Set();
                          for (const line of lines) {
                            const cleanLine = line.replace(/^([•\-\*]|\[\d+:\d+\]|💡|💬|\d+\.)\s*/g, '').replace(/\[\d+:\d+\]/g, '').trim();
                            if (cleanLine.length < 4) continue;
                            const match = findFuzzyOffset(fullText, cleanLine);
                            if (match) {
                              const key = match.start + '-' + match.end;
                              if (!seenRanges.has(key)) {
                                seenRanges.add(key);
                                results.push(match);
                              }
                            } else {
                              const subSentences = cleanLine.split(/[。；!?!?\n]+/).map(s => s.trim()).filter(s => s.length >= 6);
                              for (const sub of subSentences) {
                                const subMatch = findFuzzyOffset(fullText, sub);
                                if (subMatch) {
                                  const key = subMatch.start + '-' + subMatch.end;
                                  if (!seenRanges.has(key)) {
                                    seenRanges.add(key);
                                    results.push(subMatch);
                                  }
                                }
                              }
                            }
                          }
                          return results;
                        }

                        function restoreHighlights(root, highlights) {
                          if (!root) return;
                          const fullText = root.textContent;
                          const processedHighlights = [];
                          for (const hl of highlights) {
                            if (hl.location_start == null || hl.location_end == null) {
                              if (hl.text) {
                                const matches = findFuzzyOffsetsForBlock(fullText, hl.text);
                                if (matches.length > 0) {
                                  matches.forEach((m, idx) => {
                                    processedHighlights.push({
                                      ...hl,
                                      id: matches.length > 1 ? (hl.id + '-seg-' + idx) : hl.id,
                                      location_start: m.start,
                                      location_end: m.end
                                    });
                                  });
                                } else {
                                  processedHighlights.push({ ...hl, location_start: null, location_end: null });
                                }
                              } else {
                                processedHighlights.push(hl);
                              }
                            } else {
                              processedHighlights.push(hl);
                            }
                          }
                          const validHighlights = processedHighlights.filter(hl => hl.location_start != null && hl.location_end != null);
                          const sorted = [...validHighlights].sort((a, b) => b.location_start - a.location_start);
                          for (const hl of sorted) {
                            const startObj = getNodeAndOffsetAt(root, hl.location_start);
                            const endObj = getNodeAndOffsetAt(root, hl.location_end);
                            if (startObj && endObj) {
                              const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
                              walker.currentNode = startObj.node;
                              const nodes = [startObj.node];
                              if (startObj.node !== endObj.node) {
                                let n;
                                while ((n = walker.nextNode())) {
                                  nodes.push(n);
                                  if (n === endObj.node) break;
                                }
                              }
                              nodes.forEach((n, idx) => {
                                const isFirst = (idx === 0);
                                const isLast = (idx === nodes.length - 1);
                                let start = isFirst ? startObj.offset : 0;
                                let end = isLast ? endObj.offset : n.textContent.length;
                                const textSegment = n.textContent.substring(start, end);
                                if (start < end && textSegment.trim().length > 0) {
                                  const mark = document.createElement('mark');
                                  mark.className = 'highlight-color ' + (hl.color || 'yellow');
                                  mark.dataset.highlightId = hl.id;
                                  const middle = n.splitText(start);
                                  middle.splitText(end - start);
                                  mark.appendChild(middle.cloneNode(true));
                                  if (middle.parentNode) {
                                    middle.parentNode.replaceChild(mark, middle);
                                  }
                                  mark.style.cursor = 'pointer';
                                  mark.onclick = function(e) {
                                    e.stopPropagation();
                                    if (window.AndroidBridge && typeof window.AndroidBridge.onHighlightClicked === 'function') {
                                      window.AndroidBridge.onHighlightClicked(hl.id);
                                    }
                                  };
                                }
                              });
                            }
                          }
                        }

                        window.updateHighlights = function(newHighlights) {
                          if (typeof window.originalHtml === 'undefined' || window.originalHtml === null) {
                            return;
                          }
                          try {
                            const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
                            document.body.innerHTML = window.originalHtml;
                            restoreHighlights(document.body, newHighlights);
                            document.documentElement.scrollTop = scrollTop;
                            document.body.scrollTop = scrollTop;
                            setTimeout(() => {
                              document.documentElement.scrollTop = scrollTop;
                              document.body.scrollTop = scrollTop;
                            }, 10);
                          } catch(e) {
                            console.error("Failed to update highlights:", e);
                          }
                        };

                        window.scrollToHighlight = function(hlId, hlText) {
                          try {
                            var target = document.querySelector('mark[data-highlight-id="' + hlId + '"], mark[data-highlight-id^="' + hlId + '-"]');
                            if (!target && hlText) {
                              var cleanText = hlText.replace(/^["“'”\s]+|["“'”\s]+$/g, '').trim();
                              if (cleanText.length >= 2) {
                                var elms = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, dt, dd, td, th, span, div, mark'));
                                var validElements = elms.filter(function(el) {
                                  if (el === document.body || el === document.documentElement) return false;
                                  var blockChildCount = el.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, section, article, div').length;
                                  return blockChildCount <= 3;
                                });

                                validElements.sort(function(a, b) {
                                  var dA = 0, dB = 0, pA = a, pB = b;
                                  while (pA) { dA++; pA = pA.parentElement; }
                                  while (pB) { dB++; pB = pB.parentElement; }
                                  return dB - dA;
                                });

                                for (var i = 0; i < validElements.length; i++) {
                                  var el = validElements[i];
                                  var txt = (el.innerText || el.textContent || '').trim();
                                  if (txt && (txt.indexOf(cleanText) !== -1 || (txt.length >= 10 && cleanText.indexOf(txt) !== -1))) {
                                    target = el;
                                    break;
                                  }
                                }
                              }
                            }

                            if (target) {
                              var scrollToTarget = function(reason) {
                                try {
                                  var rect = target.getBoundingClientRect();
                                  var currentScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
                                  var targetY = rect.top + currentScrollTop - (window.innerHeight / 3);
                                  var finalY = Math.max(0, Math.round(targetY));
                                  window.scrollTo(0, finalY);
                                } catch(e) {
                                  console.error("scrollToHighlight scroll error:", e);
                                }
                              };

                              scrollToTarget('immediate');
                              setTimeout(function() { scrollToTarget('300ms-retry'); }, 300);
                              setTimeout(function() { scrollToTarget('800ms-retry'); }, 800);

                              var origBg = target.style.backgroundColor;
                              var origTrans = target.style.transition;
                              target.style.transition = 'background-color 0.4s ease';
                              target.style.backgroundColor = 'rgba(255, 215, 0, 0.75)';
                              target.style.borderRadius = '4px';
                              setTimeout(function() {
                                target.style.backgroundColor = origBg || '';
                                target.style.transition = origTrans || '';
                              }, 3500);
                            }
                          } catch(e) {
                            console.error("Failed to scrollToHighlight:", e);
                          }
                        };

                        /* TTS 朗读段落高亮 */
                        window.clearTtsHighlight = function() {
                          try {
                            var actives = document.querySelectorAll('.tts-active-chunk');
                            for (var i = 0; i < actives.length; i++) {
                              actives[i].classList.remove('tts-active-chunk');
                            }
                          } catch(e) {
                            console.error("Failed to clearTtsHighlight:", e);
                          }
                        };

                        window.highlightTtsChunk = function(searchText) {
                          try {
                            // 先清除之前的高亮
                            window.clearTtsHighlight();

                            if (!searchText || searchText.trim().length === 0) return;

                            // 规范化搜索文本：去除多余空白
                            var normalizedSearch = searchText.replace(/\s+/g, ' ').trim();
                            // 取前40个字符作为匹配关键字（避免特殊字符干扰）
                            var searchKey = normalizedSearch.substring(0, 40);

                            // 搜索所有块级元素
                            var blockTags = ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                                             'BLOCKQUOTE', 'PRE', 'DT', 'DD', 'SECTION', 'ARTICLE',
                                             'FIGCAPTION', 'TD', 'TH'];
                            var allBlocks = [];
                            for (var t = 0; t < blockTags.length; t++) {
                              var els = document.body.getElementsByTagName(blockTags[t]);
                              for (var i = 0; i < els.length; i++) {
                                allBlocks.push(els[i]);
                              }
                            }

                            // 查找文本内容匹配的块级元素
                            var bestMatch = null;
                            var bestScore = 0;

                            for (var i = 0; i < allBlocks.length; i++) {
                              var el = allBlocks[i];
                              // 跳过包含其他块级元素的父容器（避免高亮整个 section/article）
                              var hasBlockChild = false;
                              for (var c = 0; c < el.children.length; c++) {
                                if (blockTags.indexOf(el.children[c].tagName) >= 0) {
                                  hasBlockChild = true;
                                  break;
                                }
                              }
                              if (hasBlockChild) continue;

                              var elText = el.textContent || '';
                              var normalizedElText = elText.replace(/\s+/g, ' ').trim();

                              if (normalizedElText.length === 0) continue;

                              // 完整匹配检查
                              if (normalizedElText.indexOf(searchKey) >= 0) {
                                // 计算匹配分数：文本长度越接近搜索文本越优
                                var lenDiff = Math.abs(normalizedElText.length - normalizedSearch.length);
                                var score = 1000 - lenDiff;
                                if (normalizedElText.indexOf(searchKey) === 0) {
                                  score += 500; // 起始位置匹配的加分
                                }
                                if (score > bestScore) {
                                  bestScore = score;
                                  bestMatch = el;
                                }
                              }
                            }

                            if (bestMatch) {
                              bestMatch.classList.add('tts-active-chunk');
                              // 平滑滚动到高亮元素
                              var containerRect = document.body.getBoundingClientRect();
                              var elementRect = bestMatch.getBoundingClientRect();
                              var relativeTop = elementRect.top - containerRect.top;
                              var targetScrollTop = relativeTop - (window.innerHeight * 0.3);
                              window.scrollTo({
                                top: targetScrollTop,
                                behavior: 'smooth'
                              });
                            }
                          } catch(e) {
                            console.error("Failed to highlightTtsChunk:", e);
                          }
                        };

                        // 修改 restoreHighlights 使其返回处理后的高亮数据
                        function restoreHighlightsAndGetPositions(root, highlights) {
                          if (!root) return highlights;
                          const fullText = root.textContent;
                          const processedHighlights = highlights.map(hl => {
                            var isValidOffset = false;
                            if (hl.location_start != null && hl.location_end != null && hl.location_start < fullText.length) {
                              var seg = fullText.substring(hl.location_start, Math.min(hl.location_end, fullText.length));
                              if (hl.text && (seg === hl.text || seg.trim() === (hl.text || '').trim())) {
                                isValidOffset = true;
                              }
                            }
                            if (!isValidOffset && hl.text) {
                              const offset = findFuzzyOffset(fullText, hl.text);
                              if (offset) {
                                return Object.assign({}, hl, { location_start: offset.start, location_end: offset.end });
                              } else {
                                return Object.assign({}, hl, { location_start: null, location_end: null });
                              }
                            }
                            return hl;
                          });
                          // 执行 DOM 渲染（与原逻辑一致）
                          restoreHighlights(root, processedHighlights);
                          return processedHighlights;
                        }

                        try {
                          window.originalHtml = document.body.innerHTML;
                          var highlights = $highlightsJson;
                          var processed = restoreHighlightsAndGetPositions(document.body, highlights);
                          // 将推算出的位置信息回传给 Kotlin 层
                          if (window.AndroidBridge && typeof window.AndroidBridge.onHighlightPositions === 'function') {
                            var posMap = {};
                            processed.forEach(function(h) {
                              if (h.location_start != null) posMap[h.id] = h.location_start;
                            });
                            window.AndroidBridge.onHighlightPositions(JSON.stringify(posMap));
                          }
                        } catch(e) {
                          console.error("Failed to restore highlights:", e);
                        }

                        // 阅读进度滚动监听
                        (function() {
                          var ticking = false;
                          window.addEventListener('scroll', function() {
                            if (!ticking) {
                              ticking = true;
                              requestAnimationFrame(function() {
                                var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                var scrollHeight = document.documentElement.scrollHeight;
                                var clientHeight = window.innerHeight;
                                var scrollable = scrollHeight - clientHeight;
                                if (scrollable > 0) {
                                  // 阈值检测：距底部 5px 以内视为 100%
                                  var progress = (scrollTop + clientHeight >= scrollHeight - 5)
                                    ? 1.0
                                    : Math.min(scrollTop / scrollable, 1.0);
                                  if (window.AndroidBridge && typeof window.AndroidBridge.onScrollProgress === 'function') {
                                    window.AndroidBridge.onScrollProgress(progress);
                                  }
                                }
                                ticking = false;
                              });
                            }
                          }, { passive: true });
                        })();

                        // 注册全局原文锚点点击与触摸捕获
                        function getQuoteAnchor(target) {
                          if (!target) return null;
                          var el = target.nodeType === 3 ? target.parentElement : target;
                          if (!el || !el.closest) return null;
                          return el.closest('.blog-quote-anchor') || el.closest('a[href*="#quote-"]');
                        }

                        function handleQuoteAnchorClick(e) {
                          try {
                            var anchor = getQuoteAnchor(e.target);
                            if (anchor) {
                              e.preventDefault();
                              e.stopPropagation();
                              var rawHref = anchor.getAttribute('data-href') || anchor.getAttribute('href');
                              if (!rawHref && anchor.getAttribute('onclick')) {
                                var m = anchor.getAttribute('onclick').match(/#quote-[^'"]+/);
                                if (m) rawHref = m[0];
                              }
                              if (rawHref && window.AndroidBridge && typeof window.AndroidBridge.onQuoteClick === 'function') {
                                window.AndroidBridge.onQuoteClick(rawHref);
                              }
                            }
                          } catch(err) {
                            console.error("handleQuoteAnchorClick error:", err);
                          }
                        }

                        document.addEventListener('touchend', function(e) {
                          var anchor = getQuoteAnchor(e.target);
                          if (anchor) {
                            handleQuoteAnchorClick(e);
                          }
                        }, true);

                        document.addEventListener('click', handleQuoteAnchorClick, true);

                        function handleGeneralLinkClick(e) {
                          try {
                            var a = e.target.closest('a');
                            if (a) {
                              if (getQuoteAnchor(a)) return;
                              var href = a.getAttribute('href');
                              if (href) {
                                if (href.startsWith('seekto:') || href.startsWith('javascript:')) return;
                                if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:')) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (window.AndroidBridge && typeof window.AndroidBridge.onExternalLinkClick === 'function') {
                                    window.AndroidBridge.onExternalLinkClick(href);
                                  }
                                }
                              }
                            }
                          } catch(err) {
                            console.error("handleGeneralLinkClick error:", err);
                          }
                        }

                        document.addEventListener('click', handleGeneralLinkClick, true);

                        if (window.AndroidBridge && typeof window.AndroidBridge.onPageReady === 'function') {
                          window.AndroidBridge.onPageReady();
                        }
                        // 恢复阅读进度（跳转原文锚点时跳过进度恢复）
                        (function() {
                          var hasPendingQuote = ${!pendingQuoteQuery.isNullOrBlank()};
                          if (hasPendingQuote) return;
                          var savedProgress = ${initialProgress};
                          if (savedProgress > 0) {
                            setTimeout(function() {
                              var scrollHeight = document.documentElement.scrollHeight;
                              var clientHeight = window.innerHeight;
                              var scrollable = scrollHeight - clientHeight;
                              if (scrollable > 0) {
                                window.scrollTo(0, scrollable * savedProgress);
                              }
                            }, 100);
                          }
                        })();
                    </script>
                </body>
                </html>
            """.trimIndent()

            val keyChanged = lastLoadedKey.value != currentKey
            if (keyChanged) {
                pageReady.value = false
                lastLoadedKey.value = currentKey
                webView.loadDataWithBaseURL(null, styledHtml, "text/html", "UTF-8", null)
            } else if (pageReady.value) {
                webView.evaluateJavascript("if (typeof window.updateHighlights === 'function') { window.updateHighlights($highlightsJson); }", null)
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}

@Composable
fun DocumentInfoView(doc: DocumentEntity) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("文档元数据", fontWeight = FontWeight.Bold, fontSize = 17.sp, color = MaterialTheme.colorScheme.onBackground)
        
        Spacer(modifier = Modifier.height(4.dp))
        
        MetadataRow(label = "标题", value = doc.title)
        MetadataRow(label = "作者", value = doc.author ?: "未知")
        MetadataRow(label = "分类", value = doc.category ?: "默认分类")
        MetadataRow(label = "出处", value = doc.site_name ?: "本地导入")
        MetadataRow(label = "源链接", value = doc.source_url ?: doc.url)
        MetadataRow(label = "字数", value = doc.word_count?.toString() ?: "未知")
        MetadataRow(label = "阅读时长", value = doc.reading_time ?: "少于 1 分钟")
        Spacer(modifier = Modifier.height(16.dp))
    }
}

private fun parseTimestampSeconds(timeStr: String): Double {
    val parts = timeStr.split(":")
    return try {
        when (parts.size) {
            3 -> parts[0].trim().toInt() * 3600.0 + parts[1].trim().toInt() * 60.0 + parts[2].trim().toDouble()
            2 -> parts[0].trim().toInt() * 60.0 + parts[1].trim().toDouble()
            else -> 0.0
        }
    } catch (e: Exception) {
        0.0
    }
}

private fun renderHeadingWithTimestampBadge(text: String): String {
    val timestampRegex = Regex("(?:▶\\s*)?\\[?(\\d{1,2}:\\d{2}(?::\\d{2})?)\\]?")
    return text.replace(timestampRegex) { matchResult ->
        val timeStr = matchResult.groupValues[1]
        val seconds = parseTimestampSeconds(timeStr)
        " <a href=\"javascript:void(0);\" onclick=\"if(window.AndroidBridge && window.AndroidBridge.seekTo){window.AndroidBridge.seekTo($seconds);}else{location.href='seekto:$seconds';}\" style=\"display:inline-block;margin:0 4px;padding:2px 8px;background:rgba(59,130,246,0.15);color:#3B82F6;border-radius:12px;text-decoration:none;font-weight:600;font-size:12px;vertical-align:middle;\">▶ $timeStr</a>"
    }
}

private fun stripParagraphTimestamps(text: String): String {
    val timestampRegex = Regex("\\[?\\b\\d{1,2}:\\d{2}(?::\\d{2})?\\b\\]?")
    val cleaned = text.replace(timestampRegex, "")
    return cleaned.replace(Regex(" {2,}"), " ").trim()
}

private fun markdownToHtml(markdown: String): String {
    var html = markdown
    val lines = html.split("\n")
    val sb = StringBuilder()
    var inList = false
    for (line in lines) {
        val trimmed = line.trim()
        if (trimmed.startsWith("#")) {
            if (inList) { sb.append("</ul>\n"); inList = false }
            val level = trimmed.takeWhile { it == '#' }.length
            val rawText = trimmed.drop(level).trim()
            val headingText = renderHeadingWithTimestampBadge(rawText)
            sb.append("<h$level>$headingText</h$level>\n")
        } else if (trimmed.matches(Regex("^([-*_]\\s*){3,}$"))) {
            // 标准 Markdown 分割线 (--- / *** / ___)
            if (inList) { sb.append("</ul>\n"); inList = false }
            sb.append("<hr style=\"border:none;border-top:1px solid rgba(156,163,175,0.3);margin:24px 0;\"/>\n")
        } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            if (!inList) { sb.append("<ul>\n"); inList = true }
            val rawText = trimmed.drop(2).trim()
            val cleanText = stripParagraphTimestamps(rawText)
            sb.append("<li>$cleanText</li>\n")
        } else if (trimmed.isEmpty()) {
            if (inList) { sb.append("</ul>\n"); inList = false }
            sb.append("<br/>\n")
        } else {
            if (inList) { sb.append("</ul>\n"); inList = false }
            val cleanText = stripParagraphTimestamps(trimmed)
            sb.append("<p>$cleanText</p>\n")
        }
    }
    if (inList) sb.append("</ul>\n")
    html = sb.toString()
    
    html = html.replace(Regex("\\*\\*(.*?)\\*\\*"), "<strong>$1</strong>")
    html = html.replace(Regex("\\*(.*?)\\*"), "<em>$1</em>")
    html = html.replace(Regex("\\[(.*?)\\]\\((#quote-[^)]+)\\)")) { m ->
        var label = m.groupValues[1].removePrefix("🔗").trim()
        if (label.isEmpty()) label = "原文"
        val rawHref = m.groupValues[2]
        val attrEscapedHref = rawHref.replace("\"", "&quot;").replace("'", "&apos;")
        val jsEscapedHref = rawHref.replace("\\", "\\\\").replace("'", "\\'")
        "<span class=\"blog-quote-anchor\" data-href=\"$attrEscapedHref\" onclick=\"if(window.AndroidBridge && typeof window.AndroidBridge.onQuoteClick === 'function'){window.AndroidBridge.onQuoteClick('$jsEscapedHref');}\" style=\"display:inline-flex;align-items:center;gap:3px;padding:1px 8px;margin:0 4px;border-radius:12px;background-color:rgba(0,122,255,0.12);color:#007aff;font-size:12px;font-weight:600;cursor:pointer;border:1px solid rgba(0,122,255,0.25);vertical-align:middle;\">🔗 $label</span>"
    }
    html = html.replace(Regex("\\[(.*?)\\]\\((?!#quote-)(.*?)\\)"), "<a href=\"$2\" target=\"_blank\">$1</a>")

    html += """
    <div style="margin-top: 48px; padding-top: 24px; border-top: 1px dashed rgba(128,128,128,0.25); text-align: center; margin-bottom: 32px;">
        <button id="btn-regenerate-blog" onclick="if(window.AndroidBridge && typeof window.AndroidBridge.onRegenerateBlog === 'function'){window.AndroidBridge.onRegenerateBlog();}" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: rgba(0, 122, 255, 0.08); border: 1px solid rgba(0, 122, 255, 0.3); border-radius: 20px; padding: 10px 22px; font-size: 14px; font-weight: 600; color: #007aff; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,122,255,0.12); touch-action: manipulation;">
            🔄 重新生成 AI 博客
        </button>
    </div>
    """.trimIndent()

    return html
}

@Composable
fun MetadataRow(label: String, value: String) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(text = label, color = Color.Gray, fontSize = 11.sp)
        Spacer(modifier = Modifier.height(2.dp))
        Text(text = value, color = MaterialTheme.colorScheme.onBackground, fontSize = 13.sp)
        Divider(color = Color.Gray.copy(alpha = 0.15f), modifier = Modifier.padding(top = 8.dp))
    }
}

/**
 * 视频文章专用布局：YouTube 播放器 + 字幕面板
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun VideoReadingContent(
    doc: DocumentEntity,
    viewModel: MainViewModel,
    videoReadingMode: String, // "lyrics" | "blog" | "subtitles"
    articleContent: @Composable (Modifier, ((Float) -> Unit)?) -> Unit,
    modifier: Modifier = Modifier
) {
    val subtitles by viewModel.subtitles.collectAsState()
    val subtitleLoading by viewModel.subtitleLoading.collectAsState()
    var webView by remember { mutableStateOf<WebView?>(null) }
    var currentTime by remember { mutableStateOf(0f) }

    // 从 source_url 提取 YouTube 视频 ID
    val videoId = remember(doc.source_url, doc.url) {
        extractYouTubeVideoId(doc.source_url ?: doc.url)
    }

    var videoHeightRatio by remember { mutableStateOf(0.38f) }
    var leftColumnRatio by remember { mutableStateOf(0.58f) }

    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val totalWidth = maxWidth
        val totalHeight = maxHeight
        val density = LocalDensity.current
        val totalWidthPx = with(density) { totalWidth.toPx() }
        val totalHeightPx = with(density) { totalHeight.toPx() }
        val isDark = MaterialTheme.colorScheme.background.luminance() < 0.5f
        val isWideScreen = totalWidth >= 600.dp

        @Composable
        fun PlayerComposable(heightDp: androidx.compose.ui.unit.Dp) {
            if (videoId != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(heightDp)
                        .background(Color.Black)
                ) {
                    AndroidView(
                        factory = { ctx ->
                            WebView(ctx).apply {
                                layoutParams = android.view.ViewGroup.LayoutParams(
                                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                                    android.view.ViewGroup.LayoutParams.MATCH_PARENT
                                )
                                webView = this
                                settings.javaScriptEnabled = true
                                settings.domStorageEnabled = true
                                settings.mediaPlaybackRequiresUserGesture = false
                                val defaultUa = settings.userAgentString
                                settings.userAgentString = defaultUa.replace("; wv", "")
                                webViewClient = WebViewClient()
                                webChromeClient = android.webkit.WebChromeClient()
                                setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
                                addJavascriptInterface(object : Any() {
                                    @android.webkit.JavascriptInterface
                                    fun updateTime(time: Float) {
                                        post {
                                            currentTime = time
                                        }
                                    }
                                }, "AndroidApp")
                            }
                        },
                        modifier = Modifier.fillMaxSize().alpha(0.99f)
                    )
                    
                    LaunchedEffect(viewModel, webView) {
                        viewModel.videoSeekEvent.collect { seconds ->
                            webView?.evaluateJavascript("if (typeof seekTo === 'function') { seekTo($seconds); }", null)
                        }
                    }
                    
                    LaunchedEffect(videoId, webView) {
                        if (videoId != null && webView != null) {
                            val embedHtml = """
                                <!DOCTYPE html>
                                <html><head>
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <style>
                                    * { margin: 0; padding: 0; }
                                    body { background: #000; }
                                    #player { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
                                </style>
                                </head><body>
                                <div id="player"></div>
                                <script>
                                    var player;
                                    function onYouTubeIframeAPIReady() {
                                        player = new YT.Player('player', {
                                            videoId: '$videoId',
                                            host: 'https://www.youtube.com',
                                            playerVars: { 'playsinline': 1, 'autoplay': 0, 'modestbranding': 1, 'rel': 0, 'enablejsapi': 1, 'origin': 'https://readerq.app' }
                                        });
                                        setInterval(function() {
                                            if (player && typeof player.getCurrentTime === 'function') {
                                                var time = player.getCurrentTime();
                                                if (window.AndroidApp && window.AndroidApp.updateTime) {
                                                    window.AndroidApp.updateTime(time);
                                                }
                                            }
                                        }, 250);
                                    }
                                    window.seekTo = function(time) {
                                        var secs = parseFloat(time);
                                        if (!isNaN(secs) && player && typeof player.seekTo === 'function') {
                                            player.seekTo(secs, true);
                                            if (typeof player.playVideo === 'function') {
                                                player.playVideo();
                                            }
                                        }
                                    };
                                    var tag = document.createElement('script');
                                    tag.src = "https://www.youtube.com/iframe_api";
                                    var firstScriptTag = document.getElementsByTagName('script')[0];
                                    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                                </script>
                                </body></html>
                            """.trimIndent()
                            webView?.loadDataWithBaseURL(
                                "https://readerq.app",
                                embedHtml,
                                "text/html",
                                "UTF-8",
                                null
                            )
                        }
                    }
                }
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .background(Color(0xFF1a1a2e)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "无法识别视频链接",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 14.sp
                    )
                }
            }
        }

        @Composable
        fun VerticalDragDivider() {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(14.dp)
                    .background(if (isDark) Color(0xFF16162A) else Color(0xFFE2E4ED))
                    .pointerInput(Unit) {
                        detectDragGestures { change, dragAmount ->
                            change.consume()
                            if (totalHeightPx > 0) {
                                val deltaRatio = dragAmount.y / totalHeightPx
                                videoHeightRatio = (videoHeightRatio + deltaRatio).coerceIn(0.15f, 0.80f)
                            }
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .width(42.dp)
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.35f))
                )
            }
        }

        @Composable
        fun BlogContentWithBanner(modifier: Modifier = Modifier) {
            Column(modifier = modifier.fillMaxSize()) {
                val aiErrMsg by viewModel.aiErrorMessage.collectAsState()
                val activeProgressState by viewModel.activeSubtitleProgress.collectAsState()
                val rawProgress = activeProgressState
                val errText = aiErrMsg ?: if (!rawProgress.isNullOrBlank() && rawProgress.contains("⚠️")) rawProgress else null

                if (!errText.isNullOrBlank()) {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        shape = RoundedCornerShape(10.dp),
                        color = Color(0xFFEF4444).copy(alpha = 0.12f),
                        border = BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.4f))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = errText,
                                fontSize = 12.sp,
                                color = Color(0xFFEF4444),
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.weight(1f)
                            )
                            TextButton(
                                onClick = { viewModel.dismissAiErrorMessage() },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Text("忽略 ✕", fontSize = 11.sp, color = Color(0xFFEF4444))
                            }
                        }
                    }
                }

                val hasNewerBlog by viewModel.hasNewerBlogVersion.collectAsState()
                if (hasNewerBlog) {
                    val accentColor = Color(0xFF3B82F6)
                    val blogLocalVer by viewModel.blogLocalVersion.collectAsState()
                    val blogCloudVer by viewModel.blogCloudVersion.collectAsState()
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        shape = RoundedCornerShape(10.dp),
                        color = accentColor.copy(alpha = 0.12f),
                        border = BorderStroke(1.dp, accentColor.copy(alpha = 0.3f))
                    ) {
                        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("✨ 检测到云端已生成最新视频博客，是否下载？", fontSize = 12.sp, color = MaterialTheme.colorScheme.onBackground, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Button(
                                        onClick = { viewModel.applyNewerBlog(doc.id) },
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                        shape = RoundedCornerShape(6.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = accentColor)
                                    ) {
                                        Text("📥 立即下载", fontSize = 11.sp, color = Color.White, fontWeight = FontWeight.Bold)
                                    }
                                    TextButton(
                                        onClick = { viewModel.ignoreNewerBlog() },
                                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 4.dp)
                                    ) {
                                        Text("忽略", fontSize = 11.sp, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f))
                                    }
                                }
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                                horizontalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                Text("📍 本地版本: ${blogLocalVer ?: "未生成 / 暂无"}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f))
                                Text("☁️ 云端版本: ${blogCloudVer ?: "最新视频博客"}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f))
                            }
                        }
                    }
                }

                articleContent(
                    Modifier.fillMaxSize().weight(1f),
                    { time -> webView?.evaluateJavascript("seekTo($time)", null) }
                )
            }
        }

        if (isWideScreen && videoReadingMode == "lyrics") {
            // 🎯 宽屏歌词模式：左右分栏 (左：视频 + 博客，右：沉浸歌词流)
            Row(modifier = Modifier.fillMaxSize()) {
                Column(
                    modifier = Modifier
                        .weight(leftColumnRatio)
                        .fillMaxHeight()
                ) {
                    val currentVideoHeight = totalHeight * videoHeightRatio
                    PlayerComposable(currentVideoHeight)
                    VerticalDragDivider()
                    Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
                        BlogContentWithBanner(Modifier.fillMaxSize())
                    }
                }

                // ↔️ 左右拖拽条
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .width(14.dp)
                        .background(if (isDark) Color(0xFF16162A) else Color(0xFFE2E8F0))
                        .pointerInput(Unit) {
                            detectDragGestures { change, dragAmount ->
                                change.consume()
                                if (totalWidthPx > 0) {
                                    val deltaRatio = dragAmount.x / totalWidthPx
                                    leftColumnRatio = (leftColumnRatio + deltaRatio).coerceIn(0.25f, 0.75f)
                                }
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .width(4.dp)
                            .height(42.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.35f))
                    )
                }

                // 右侧沉浸歌词流
                Box(
                    modifier = Modifier
                        .weight(1f - leftColumnRatio)
                        .fillMaxHeight()
                ) {
                    LyricSubtitlePaneComposable(
                        doc = doc,
                        viewModel = viewModel,
                        subtitles = subtitles,
                        isLoading = subtitleLoading,
                        currentTime = currentTime,
                        onSeekTo = { time ->
                            webView?.evaluateJavascript("seekTo($time)", null)
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        } else {
            // 🎯 单列上下布局（宽屏博客/字幕模式，或窄屏下的歌词/博客/字幕模式）
            Column(modifier = Modifier.fillMaxSize()) {
                val currentVideoHeight = totalHeight * videoHeightRatio
                PlayerComposable(currentVideoHeight)
                VerticalDragDivider()

                // 下方面板根据 videoReadingMode 渲染
                Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
                    when (videoReadingMode) {
                        "blog" -> {
                            BlogContentWithBanner(Modifier.fillMaxSize())
                        }
                        "subtitles" -> {
                            SubtitlePanelComposable(
                                doc = doc,
                                viewModel = viewModel,
                                subtitles = subtitles,
                                isLoading = subtitleLoading,
                                currentTime = currentTime,
                                onSeekTo = { time ->
                                    webView?.evaluateJavascript("seekTo($time)", null)
                                },
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                        else -> { // "lyrics" (在窄屏下展示沉浸歌词流)
                            LyricSubtitlePaneComposable(
                                doc = doc,
                                viewModel = viewModel,
                                subtitles = subtitles,
                                isLoading = subtitleLoading,
                                currentTime = currentTime,
                                onSeekTo = { time ->
                                    webView?.evaluateJavascript("seekTo($time)", null)
                                },
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Apple Music 风格沉浸式歌词/字幕面板
 */
@Composable
fun LyricSubtitlePaneComposable(
    doc: DocumentEntity,
    viewModel: MainViewModel,
    subtitles: List<com.readerq.app.api.SubtitleSegment>,
    isLoading: Boolean,
    currentTime: Float = 0f,
    onSeekTo: ((Float) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val isDark = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val panelBg = if (isDark) Color(0xFF0F172A) else Color(0xFFF8FAFC)
    val textColor = MaterialTheme.colorScheme.onBackground
    val accentColor = Color(0xFF3B82F6)

    var isAutoScrollEnabled by remember { mutableStateOf(true) }
    var isUserInteracting by remember { mutableStateOf(false) }

    // SRT 文件选择器
    val srtPickerLauncher = rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            try {
                val inputStream = context.contentResolver.openInputStream(it)
                val srtContent = inputStream?.bufferedReader()?.use { reader -> reader.readText() }
                if (!srtContent.isNullOrBlank()) {
                    viewModel.uploadSubtitle(doc.id, srtContent)
                    Toast.makeText(context, "字幕已上传", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "读取文件失败: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    Column(
        modifier = modifier
            .background(panelBg)
            .padding(top = 8.dp)
    ) {
        // 顶部 Header 标题与控制操作工具栏 (下载字幕、上传/替换、删除、自动跟随)
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            val isNarrow = maxWidth < 340.dp
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // 左侧：标题与行数
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "歌词字幕",
                        tint = accentColor,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = "沉浸歌词",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = textColor
                    )
                    if (!isNarrow && subtitles.isNotEmpty()) {
                        Text(
                            text = "${subtitles.size}句",
                            fontSize = 11.sp,
                            color = textColor.copy(alpha = 0.5f)
                        )
                    }
                }

                // 右侧：字幕控制按钮组 (下载字幕、上传/替换、删除、自动跟随) - 响应式超紧凑布局
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    // 🎬 下载字幕按钮 (仅 YouTube 视频)
                    val videoUrl = doc.source_url ?: doc.url
                    val isYouTubeVideo = videoUrl.contains("youtube.com") || videoUrl.contains("youtu.be")
                    val isDownloading by viewModel.subtitleDownloading.collectAsState()
                    if (isYouTubeVideo) {
                        Surface(
                            onClick = {
                                if (!isDownloading) {
                                    viewModel.downloadSubtitleFromServer(doc.id, videoUrl, doc.title)
                                    Toast.makeText(context, "正在从服务器下载字幕...", Toast.LENGTH_SHORT).show()
                                }
                            },
                            shape = RoundedCornerShape(6.dp),
                            color = if (isDownloading) Color(0xFF6366F1).copy(alpha = 0.08f) else Color(0xFF6366F1).copy(alpha = 0.15f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = if (isNarrow) 6.dp else 7.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = "下载字幕",
                                    modifier = Modifier.size(13.dp),
                                    tint = if (isDownloading) Color(0xFF6366F1).copy(alpha = 0.5f) else Color(0xFF6366F1)
                                )
                                if (!isNarrow) {
                                    Text(
                                        text = if (isDownloading) "提取中" else "下载",
                                        fontSize = 10.5.sp,
                                        color = if (isDownloading) Color(0xFF6366F1).copy(alpha = 0.5f) else Color(0xFF6366F1),
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }

                    // 📤 上传 SRT / 替换 按钮
                    Surface(
                        onClick = { srtPickerLauncher.launch("*/*") },
                        shape = RoundedCornerShape(6.dp),
                        color = accentColor.copy(alpha = 0.15f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = if (isNarrow) 6.dp else 7.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = "替换字幕",
                                modifier = Modifier.size(13.dp),
                                tint = accentColor
                            )
                            if (!isNarrow) {
                                Text(
                                    text = if (subtitles.isEmpty()) "上传" else "替换",
                                    fontSize = 10.5.sp,
                                    color = accentColor,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }

                    // 🗑️ 删除字幕按钮 (仅在有字幕时显示)
                    if (subtitles.isNotEmpty()) {
                        Surface(
                            onClick = {
                                viewModel.deleteSubtitle(doc.id)
                                Toast.makeText(context, "字幕已删除", Toast.LENGTH_SHORT).show()
                            },
                            shape = RoundedCornerShape(6.dp),
                            color = Color(0xFFEF4444).copy(alpha = 0.15f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = if (isNarrow) 6.dp else 7.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Delete,
                                    contentDescription = "删除字幕",
                                    modifier = Modifier.size(13.dp),
                                    tint = Color(0xFFEF4444)
                                )
                                if (!isNarrow) {
                                    Text(
                                        text = "删除",
                                        fontSize = 10.5.sp,
                                        color = Color(0xFFEF4444),
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }

                    // 🎯 自动跟随滚动开关
                    IconButton(
                        onClick = { isAutoScrollEnabled = !isAutoScrollEnabled },
                        modifier = Modifier.size(26.dp)
                    ) {
                        Icon(
                            imageVector = if (isAutoScrollEnabled) Icons.Default.PlayArrow else Icons.Default.Edit,
                            contentDescription = if (isAutoScrollEnabled) "关闭自动跟随" else "开启自动跟随",
                            tint = if (isAutoScrollEnabled) accentColor else textColor.copy(alpha = 0.4f),
                            modifier = Modifier.size(15.dp)
                        )
                    }
                }
            }
        }

        Divider(color = if (isDark) Color(0xFF1E293B) else Color(0xFFE2E8F0))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp), color = accentColor, strokeWidth = 2.dp)
            }
        } else if (subtitles.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("暂无双语字幕", fontSize = 14.sp, color = textColor.copy(alpha = 0.5f))
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("可在「字幕」面板上传 SRT 文件获取字幕", fontSize = 12.sp, color = textColor.copy(alpha = 0.35f))
                }
            }
        } else {
            val listState = androidx.compose.foundation.lazy.rememberLazyListState()
            val activeIndex = subtitles.indexOfLast { currentTime >= it.startTime }
            val coroutineScope = rememberCoroutineScope()

            // 监听用户滑动状态：当用户滑动列表时，暂停自动跟随；停止滑动 3 秒后平滑恢复跟随
            var isProgrammaticScroll by remember { mutableStateOf(false) }
            LaunchedEffect(listState.isScrollInProgress) {
                if (listState.isScrollInProgress) {
                    if (!isProgrammaticScroll) {
                        isUserInteracting = true
                    }
                } else {
                    if (isUserInteracting) {
                        kotlinx.coroutines.delay(3000L)
                        isUserInteracting = false
                    }
                }
            }

            // 自动平滑居中滚动至当前播放的字幕行 (Apple Music 歌词效果)
            LaunchedEffect(activeIndex, isAutoScrollEnabled, isUserInteracting) {
                if (isAutoScrollEnabled && !isUserInteracting && activeIndex >= 0 && activeIndex < subtitles.size) {
                    isProgrammaticScroll = true
                    try {
                        listState.animateScrollToItem(
                            index = activeIndex,
                            scrollOffset = 0
                        )
                    } finally {
                        kotlinx.coroutines.delay(100L)
                        isProgrammaticScroll = false
                    }
                }
            }

            // 判断当前播放字幕是否在屏幕可视范围内（仅当 activeIndex 改变时订阅计算，避免每帧触发重组）
            val isCurrentVisible by remember(activeIndex) {
                derivedStateOf {
                    if (activeIndex < 0) true
                    else listState.layoutInfo.visibleItemsInfo.any { it.index == activeIndex }
                }
            }

            BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                val viewportHeightDp = maxHeight
                val verticalCenterPadding = (viewportHeightDp / 2 - 40.dp).coerceAtLeast(16.dp)

                androidx.compose.foundation.lazy.LazyColumn(
                    state = listState,
                    contentPadding = PaddingValues(
                        top = verticalCenterPadding,
                        bottom = verticalCenterPadding,
                        start = 16.dp,
                        end = 16.dp
                    ),
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    items(
                        count = subtitles.size,
                        key = { index -> subtitles[index].startTime }
                    ) { index ->
                        val segment = subtitles[index]
                        val isActive = index == activeIndex

                        val rowAlpha by animateFloatAsState(
                            targetValue = if (isActive) 1.0f else 0.45f,
                            animationSpec = tween(durationMillis = 300),
                            label = "lyricAlpha"
                        )
                        val bgAlpha by animateFloatAsState(
                            targetValue = if (isActive) 1.0f else 0.0f,
                            animationSpec = tween(durationMillis = 300),
                            label = "lyricBgAlpha"
                        )

                        // 固定基础字号，避免动态测量与重新换行导致高度跳跃与抖动
                        val titleSize = 15.sp
                        val subTitleSize = 12.5.sp

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .alpha(rowAlpha)
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    if (isDark) {
                                        Color(0xFF1E293B).copy(alpha = bgAlpha)
                                    } else {
                                        Color(0xFFEFF6FF).copy(alpha = bgAlpha)
                                    }
                                )
                                .border(
                                    width = 1.dp,
                                    color = if (isActive) accentColor.copy(alpha = 0.5f * bgAlpha) else Color.Transparent,
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .clickable {
                                    isUserInteracting = false
                                    viewModel.seekVideoTo(segment.startTime.toFloat())
                                    onSeekTo?.invoke(segment.startTime.toFloat())
                                }
                                .padding(horizontal = 14.dp, vertical = 10.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)
                            ) {
                                Text(
                                    text = com.readerq.app.api.SrtParser.formatTime(segment.startTime),
                                    fontSize = 11.sp,
                                    color = if (isActive) accentColor else textColor.copy(alpha = 0.4f),
                                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal
                                )
                                if (isActive) {
                                    Text(
                                        text = "Playing",
                                        fontSize = 10.sp,
                                        color = accentColor,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier
                                            .background(accentColor.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }

                            if (!segment.zh.isNullOrBlank()) {
                                Text(
                                    text = segment.zh,
                                    fontSize = titleSize,
                                    color = if (isActive) (if (isDark) Color.White else Color(0xFF1E293B)) else textColor.copy(alpha = 0.85f),
                                    lineHeight = 22.sp,
                                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium
                                )
                                val enText = segment.en ?: segment.text
                                if (enText.isNotBlank() && enText != segment.zh) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = enText,
                                        fontSize = subTitleSize,
                                        color = if (isActive) accentColor.copy(alpha = 0.95f) else textColor.copy(alpha = 0.55f),
                                        lineHeight = 17.sp,
                                        fontWeight = if (isActive) FontWeight.Medium else FontWeight.Normal
                                    )
                                }
                            } else {
                                Text(
                                    text = segment.text,
                                    fontSize = titleSize,
                                    color = if (isActive) (if (isDark) Color.White else Color(0xFF1E293B)) else textColor.copy(alpha = 0.85f),
                                    lineHeight = 22.sp,
                                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                // 当当前播放字幕不在屏幕视野中时，显示“📍 对焦当前字幕”悬浮对焦按钮
                if (!isCurrentVisible && activeIndex >= 0 && activeIndex < subtitles.size) {
                    Surface(
                        onClick = {
                            isUserInteracting = false
                            isAutoScrollEnabled = true
                            coroutineScope.launch {
                                isProgrammaticScroll = true
                                try {
                                    listState.animateScrollToItem(
                                        index = activeIndex,
                                        scrollOffset = 0
                                    )
                                } finally {
                                    kotlinx.coroutines.delay(100L)
                                    isProgrammaticScroll = false
                                }
                            }
                        },
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = 16.dp),
                        shape = RoundedCornerShape(20.dp),
                        color = accentColor,
                        shadowElevation = 6.dp
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = "对焦当前字幕",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "📍 对焦当前字幕",
                                fontSize = 12.5.sp,
                                color = Color.White,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * 字幕面板 Composable
 */
@Composable
fun SubtitlePanelComposable(
    doc: DocumentEntity,
    viewModel: MainViewModel,
    subtitles: List<com.readerq.app.api.SubtitleSegment>,
    isLoading: Boolean,
    currentTime: Float = 0f,
    onSeekTo: ((Float) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val isDark = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val panelBg = if (isDark) Color(0xFF1A1A2E) else Color(0xFFF8F9FA)
    val borderColor = if (isDark) Color(0xFF333355) else Color(0xFFDEE2E6)
    val accentColor = Color(0xFF3B82F6)
    val textColor = MaterialTheme.colorScheme.onBackground

    // 文件选择器
    val srtPickerLauncher = rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            try {
                val inputStream = context.contentResolver.openInputStream(it)
                val srtContent = inputStream?.bufferedReader()?.use { reader -> reader.readText() }
                if (!srtContent.isNullOrBlank()) {
                    viewModel.uploadSubtitle(doc.id, srtContent)
                    Toast.makeText(context, "字幕已上传", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "读取文件失败: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    Column(
        modifier = modifier
            .background(panelBg)
    ) {
        // 面板标题栏
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .background(if (isDark) Color(0xFF16162A) else Color(0xFFEEEFF5))
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            val isNarrow = maxWidth < 340.dp
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "字幕",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    color = textColor
                )

                Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    // 🎬 下载字幕按钮（仅对 YouTube 视频文章显示）
                    val videoUrl = doc.source_url ?: doc.url
                    val isYouTubeVideo = videoUrl.contains("youtube.com") || videoUrl.contains("youtu.be")
                    val isDownloading by viewModel.subtitleDownloading.collectAsState()
                    if (isYouTubeVideo) {
                        Surface(
                            onClick = {
                                if (!isDownloading) {
                                    viewModel.downloadSubtitleFromServer(doc.id, videoUrl, doc.title)
                                    Toast.makeText(context, "正在从服务器下载字幕...", Toast.LENGTH_SHORT).show()
                                }
                            },
                            shape = RoundedCornerShape(6.dp),
                            color = if (isDownloading) Color(0xFF6366F1).copy(alpha = 0.08f) else Color(0xFF6366F1).copy(alpha = 0.15f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = if (isNarrow) 6.dp else 7.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = "下载字幕",
                                    modifier = Modifier.size(13.dp),
                                    tint = if (isDownloading) Color(0xFF6366F1).copy(alpha = 0.5f) else Color(0xFF6366F1)
                                )
                                if (!isNarrow) {
                                    Text(
                                        text = if (isDownloading) "提取中" else "下载",
                                        fontSize = 10.5.sp,
                                        color = if (isDownloading) Color(0xFF6366F1).copy(alpha = 0.5f) else Color(0xFF6366F1),
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }
                    // 上传按钮
                    Surface(
                        onClick = { srtPickerLauncher.launch("*/*") },
                        shape = RoundedCornerShape(6.dp),
                        color = accentColor.copy(alpha = 0.15f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = if (isNarrow) 6.dp else 7.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = "替换字幕",
                                modifier = Modifier.size(13.dp),
                                tint = accentColor
                            )
                            if (!isNarrow) {
                                Text(
                                    text = if (subtitles.isEmpty()) "上传" else "替换",
                                    fontSize = 10.5.sp,
                                    color = accentColor,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                    // 删除按钮（只在有字幕时显示）
                    if (subtitles.isNotEmpty()) {
                        Surface(
                            onClick = {
                                viewModel.deleteSubtitle(doc.id)
                                Toast.makeText(context, "字幕已删除", Toast.LENGTH_SHORT).show()
                            },
                            shape = RoundedCornerShape(6.dp),
                            color = Color(0xFFEF4444).copy(alpha = 0.15f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = if (isNarrow) 6.dp else 7.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Delete,
                                    contentDescription = "删除字幕",
                                    modifier = Modifier.size(13.dp),
                                    tint = Color(0xFFEF4444)
                                )
                                if (!isNarrow) {
                                    Text(
                                        text = "删除",
                                        fontSize = 10.5.sp,
                                        color = Color(0xFFEF4444),
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        Divider(color = borderColor, thickness = 0.5.dp)

        // 跨设备最新字幕版本提醒 Banner
        val hasNewerSubtitle by viewModel.hasNewerSubtitleVersion.collectAsState()
        if (hasNewerSubtitle) {
            val subLocalVer by viewModel.subtitleLocalVersion.collectAsState()
            val subCloudVer by viewModel.subtitleCloudVersion.collectAsState()
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                shape = RoundedCornerShape(10.dp),
                color = accentColor.copy(alpha = 0.12f),
                border = BorderStroke(1.dp, accentColor.copy(alpha = 0.3f))
            ) {
                Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("✨ 探查到云端已更新最新版本的双语字幕", fontSize = 12.sp, color = textColor, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Button(
                                onClick = { viewModel.applyNewerSubtitle(doc.id) },
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                shape = RoundedCornerShape(6.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = accentColor)
                            ) {
                                Text("切换最新", fontSize = 11.sp, color = Color.White, fontWeight = FontWeight.Bold)
                            }
                            TextButton(
                                onClick = { viewModel.ignoreNewerSubtitle() },
                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 4.dp)
                            ) {
                                Text("忽略", fontSize = 11.sp, color = textColor.copy(alpha = 0.6f))
                            }
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text("📍 本地版本: ${subLocalVer ?: "单语/无"}", fontSize = 10.sp, color = textColor.copy(alpha = 0.6f))
                        Text("☁️ 云端版本: ${subCloudVer ?: "最新双语"}", fontSize = 10.sp, color = textColor.copy(alpha = 0.6f))
                    }
                }
            }
        }

        val aiErrMsg by viewModel.aiErrorMessage.collectAsState()
        val activeProgressState by viewModel.activeSubtitleProgress.collectAsState()
        val progressMsg = activeProgressState
        val errText = aiErrMsg ?: if (!progressMsg.isNullOrBlank() && progressMsg.contains("⚠️")) progressMsg else null
        val downloadingDocId by viewModel.downloadingDocId.collectAsState()
        val isDownloadingThisDoc = downloadingDocId == doc.id

        // 📢 遇到带有 ⚠️ 标记的异常/402错误时，自动弹 Toast 提示
        LaunchedEffect(errText) {
            if (!errText.isNullOrBlank() && errText.contains("⚠️")) {
                Toast.makeText(context, errText, Toast.LENGTH_LONG).show()
            }
        }

        // 🔴 错误提醒 Warning Banner (如大模型余额不足402等，持久显示直到用户点击忽略)
        if (!errText.isNullOrBlank()) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                shape = RoundedCornerShape(10.dp),
                color = Color(0xFFEF4444).copy(alpha = 0.12f),
                border = BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.4f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = errText,
                        fontSize = 12.sp,
                        color = Color(0xFFEF4444),
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(
                        onClick = { viewModel.dismissAiErrorMessage() },
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text("忽略 ✕", fontSize = 11.sp, color = Color(0xFFEF4444))
                    }
                }
            }
        }

        // 字幕内容 / 加载与进度面板
        if (isLoading || isDownloadingThisDoc) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(32.dp),
                        color = accentColor,
                        strokeWidth = 2.5.dp
                    )
                    val currentProgressText = if (isDownloadingThisDoc) (progressMsg ?: "") else "正在加载字幕..."
                    if (currentProgressText.isNotBlank()) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = accentColor.copy(alpha = 0.12f),
                        ) {
                            Text(
                                text = currentProgressText,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                                fontSize = 12.sp,
                                color = accentColor,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        } else if (subtitles.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "暂无字幕",
                        color = textColor.copy(alpha = 0.5f),
                        fontSize = 14.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "点击上方「上传 SRT」按钮添加字幕文件",
                        color = textColor.copy(alpha = 0.3f),
                        fontSize = 12.sp
                    )
                }
            }
        } else {
            // 字幕列表
            val listState = androidx.compose.foundation.lazy.rememberLazyListState()
            val activeIndex = subtitles.indexOfLast { currentTime >= it.startTime }
            
            androidx.compose.runtime.LaunchedEffect(activeIndex) {
                if (activeIndex >= 0 && activeIndex < subtitles.size) {
                    listState.animateScrollToItem(activeIndex)
                }
            }
            
            androidx.compose.foundation.lazy.LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(subtitles.size) { index ->
                    val segment = subtitles[index]
                    val isActive = index == activeIndex
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isActive) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f) else Color.Transparent)
                            .clickable {
                                viewModel.seekVideoTo(segment.startTime.toFloat())
                                onSeekTo?.invoke(segment.startTime.toFloat())
                            }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = com.readerq.app.api.SrtParser.formatTime(segment.startTime),
                            fontSize = 11.sp,
                            color = if (isActive) MaterialTheme.colorScheme.primary else accentColor,
                            fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                            modifier = Modifier.width(42.dp)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            if (!segment.zh.isNullOrBlank()) {
                                // 有中文翻译：上面中文，下面英文
                                Text(
                                    text = segment.zh,
                                    fontSize = 13.5.sp,
                                    color = if (isActive) MaterialTheme.colorScheme.primary else textColor.copy(alpha = 0.9f),
                                    lineHeight = 19.sp,
                                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium
                                )
                                val enText = segment.en ?: segment.text
                                if (enText.isNotBlank() && enText != segment.zh) {
                                    Spacer(modifier = Modifier.height(3.dp))
                                    Text(
                                        text = enText,
                                        fontSize = 12.sp,
                                        color = if (isActive) MaterialTheme.colorScheme.primary.copy(alpha = 0.8f) else textColor.copy(alpha = 0.55f),
                                        lineHeight = 16.sp,
                                        fontWeight = FontWeight.Normal
                                    )
                                }
                            } else {
                                // 只有单语言：上面英文/原文
                                Text(
                                    text = segment.text,
                                    fontSize = 13.5.sp,
                                    color = if (isActive) MaterialTheme.colorScheme.primary else textColor.copy(alpha = 0.9f),
                                    lineHeight = 19.sp,
                                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium
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
 * 从 URL 中提取 YouTube 视频 ID
 */
private fun extractYouTubeVideoId(url: String): String? {
    val patterns = listOf(
        Regex("""(?:youtube\.com/watch\?.*v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})"""),
        Regex("""(?:youtube\.com/shorts/)([a-zA-Z0-9_-]{11})""")
    )
    for (pattern in patterns) {
        val match = pattern.find(url)
        if (match != null) {
            return match.groupValues[1]
        }
    }
    return null
}
