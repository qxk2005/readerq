package com.readerq.app.ui

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.foundation.BorderStroke
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
    var webViewRefState by remember { mutableStateOf<WebView?>(null) }

    var showAaSheet by remember { mutableStateOf(false) }
    var showNotebookSheet by remember { mutableStateOf(false) }
    var showAiSheet by remember { mutableStateOf(false) }
    var showInfoSheet by remember { mutableStateOf(false) }
    var showOverflowMenu by remember { mutableStateOf(false) }

    var showAiDialog by remember { mutableStateOf(false) }
    var aiCommandType by remember { mutableStateOf("") }
    var aiCommandText by remember { mutableStateOf("") }

    val textColor = MaterialTheme.colorScheme.onBackground
    val appBarBg = MaterialTheme.colorScheme.surface

    doc?.let { currentDoc ->
        Column(
            modifier = modifier
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
                        // 在双栏模式下，如果左侧侧边栏折叠，展示 library 菜单按钮用于重新恢复侧边栏并折叠右详情
                        val isSidebarCollapsed by viewModel.isSidebarCollapsed.collectAsState()
                        if (isSidebarCollapsed) {
                            IconButton(onClick = { viewModel.showSidebarAndCloseDetail() }) {
                                Icon(
                                    painter = painterResource(id = R.drawable.ic_tab_library),
                                    contentDescription = "Show Documents List",
                                    tint = textColor,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                },
                actions = {
                    // 🎯 点选高亮 Target 开关按钮 (单色 Vector Icon，风格与 Aa/Notebook 100% 保持一致)
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

                    // Aa Typesetting Setting Icon
                    IconButton(onClick = {
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
                    }) {
                        Text("Aa", fontSize = 16.sp, color = textColor, fontWeight = FontWeight.Bold)
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
                            Divider(color = Color.Gray.copy(alpha = 0.2f))
                            DropdownMenuItem(
                                text = { Text("元数据关于") },
                                onClick = {
                                    showOverflowMenu = false
                                    showInfoSheet = true
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
                                        viewModel.restoreDocument(currentDoc.id)
                                        onBack?.invoke()
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
                                        viewModel.permanentlyDeleteDocument(currentDoc.id)
                                        onBack?.invoke()
                                    }
                                )
                            } else {
                                DropdownMenuItem(
                                    text = { Text("归档文章", color = MaterialTheme.colorScheme.primary) },
                                    onClick = {
                                        showOverflowMenu = false
                                        viewModel.archiveDocument(currentDoc.id)
                                        onBack?.invoke()
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text("删除文章", color = Color.Red) },
                                    onClick = {
                                        showOverflowMenu = false
                                        viewModel.deleteDocument(currentDoc.id)
                                        onBack?.invoke()
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
                // 如果是视频文档，加载字幕与博客
                if (currentDoc.category == "video") {
                    viewModel.loadSubtitles(currentDoc.id)
                    viewModel.loadBlog(currentDoc.id)
                }
            }

            val blogContent by viewModel.blogContent.collectAsState()

            val articleContent = @Composable { articleModifier: Modifier ->
                Box(
                    modifier = articleModifier
                ) {
                val contentHtml = if (currentDoc.category == "video") {
                    val markdown = blogContent
                    if (!markdown.isNullOrBlank()) {
                        markdownToHtml(markdown)
                    } else {
                        "<div style='display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh;color:#888;font-style:italic;'><p>暂未生成博客文章。请在桌面端生成博客后，开启 OSS 跨设备同步。</p></div>"
                    }
                } else {
                    currentDoc.html_content ?: "加载中..."
                }

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
                    isVideo = currentDoc.category == "video"
                )



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
                                                        images = selectedImagesForHighlight
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
                                                        images = selectedImagesForHighlight
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
                        articleContent = articleContent,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            } else {
                articleContent(Modifier.fillMaxWidth().weight(1f))
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
    onWebViewCreated: (WebView) -> Unit = {}
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
    
    LaunchedEffect(viewModel) {
        viewModel.scrollToHighlightEvent.collect { hlId ->
            if (isVideo) {
                kotlinx.coroutines.delay(200)
            }
            webViewRef.value?.evaluateJavascript(
                "if (typeof window.scrollToHighlight === 'function') { window.scrollToHighlight('$hlId'); }",
                null
            )
        }
    }

    // TTS 朗读段落高亮：监听 ttsState 变化，在 WebView 中高亮当前朗读段落
    val ttsState by viewModel.ttsState.collectAsState()
    LaunchedEffect(ttsState.currentChunkText, ttsState.isActive) {
        val webView = webViewRef.value ?: return@LaunchedEffect
        if (!ttsState.isActive || ttsState.currentChunkText == null) {
            // TTS 未激活或没有当前段落文本 → 清除高亮
            webView.evaluateJavascript(
                "if (typeof window.clearTtsHighlight === 'function') { window.clearTtsHighlight(); }",
                null
            )
        } else {
            // 高亮当前朗读段落
            val chunkText = ttsState.currentChunkText!!
            // 取前80个字符作为搜索关键词（避免特殊字符过多）
            val searchKey = chunkText.take(80)
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "")
            webView.evaluateJavascript(
                "if (typeof window.highlightTtsChunk === 'function') { window.highlightTtsChunk(\"$searchKey\"); }",
                null
            )
        }
    }


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
    }

    val lastLoadedKey = remember { mutableStateOf("") }
    val currentKey = "${docId}_${cleanHtml.hashCode()}_${theme}_${fontFamily}_${fontSize}_${lineHeight}_${contentWidth}"
    val pageReady = remember { mutableStateOf(false) }

    AndroidView(
        factory = { context ->
            WebView(context).apply {
                webViewRef.value = this
                onWebViewCreated(this)
                
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
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        view?.loadUrl(
                            "javascript:(function() { " +
                                    "document.addEventListener('selectionchange', () => { " +
                                    "  if (window.isPickerMode) return; " +
                                    "  var sel = window.getSelection(); " +
                                    "  if (!sel.isCollapsed && sel.rangeCount > 0) { " +
                                    "    var range = sel.getRangeAt(0); " +
                                    "    var text = extractSelectionText(range); " +
                                    "    var images = extractImagesFromRange(range); " +
                                    "    if (text.trim().length > 0 || images.length > 0) { " +
                                    "      AndroidBridge.onTextSelected(text, JSON.stringify(images)); " +
                                    "      var rect = range.getBoundingClientRect(); " +
                                    "      var viewportHeight = window.innerHeight; " +
                                    "      var triggerThreshold = viewportHeight - 240; " +
                                    "      if (rect.bottom > triggerThreshold) { " +
                                    "        var scrollNeeded = rect.bottom - triggerThreshold; " +
                                    "        window.scrollBy(0, scrollNeeded); " +
                                    "      } " +
                                    "    } " +
                                    "  } " +
                                    "}); " +
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

                            if (!window.pickerStart) {
                                var text = (caretRange.startContainer.textContent || '').substring(caretRange.startOffset, caretRange.startOffset + 12) || '起点';
                                window.pickerStart = {
                                    node: caretRange.startContainer,
                                    offset: caretRange.startOffset
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
                                var endNode = caretRange.startContainer;
                                var endOffset = caretRange.startOffset;

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

                        var lastTouchTime = 0;
                        document.addEventListener('touchend', function(e) {
                            lastTouchTime = Date.now();
                            handlePickerTrigger(e);
                        }, true);

                        document.addEventListener('click', function(e) {
                            if (window.isPickerMode) {
                                e.preventDefault();
                                e.stopPropagation();
                            }
                            if (Date.now() - lastTouchTime < 500) return; // 过滤触摸后的重复 click
                            handlePickerTrigger(e);
                        }, true);
                        function extractImagesFromRange(range) {
                          const fragment = range.cloneContents();
                          const images = [];
                          const imgElements = fragment.querySelectorAll('img');
                          imgElements.forEach(img => {
                            const src = img.getAttribute('src');
                            if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                              images.push({
                                src: src,
                                alt: img.getAttribute('alt') || '图片'
                              });
                            }
                          });
                          return images;
                        }

                        function extractSelectionText(range) {
                          const BLOCK_ELEMENTS = new Set([
                            'P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                            'BR', 'HR', 'BLOCKQUOTE', 'PRE', 'TR', 'DT', 'DD',
                            'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE', 'FIGCAPTION'
                          ]);
                          
                          const fragment = range.cloneContents();
                          const parts = [];
                          
                          function walk(node, olCounter) {
                            if (node.nodeType === Node.TEXT_NODE) {
                              parts.push(node.textContent);
                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                              const tagName = node.tagName;
                              if (tagName === 'BR') {
                                parts.push('\n');
                                return;
                              }
                              if (tagName === 'IMG') {
                                const alt = node.getAttribute('alt') || '图片';
                                parts.push('[图片: ' + alt + ']');
                                return;
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
                                walk(node.childNodes[i], childCounter);
                              }
                              if (isBlock && parts.length > 0 && parts[parts.length - 1] !== '\n') {
                                parts.push('\n');
                              }
                            }
                          }
                          
                          for (let i = 0; i < fragment.childNodes.length; i++) {
                            walk(fragment.childNodes[i], null);
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

                        function restoreHighlights(root, highlights) {
                          if (!root) return;
                          const fullText = root.textContent;
                          const processedHighlights = highlights.map(hl => {
                            if (hl.location_start == null || hl.location_end == null) {
                              if (hl.text) {
                                const offset = findFuzzyOffset(fullText, hl.text);
                                if (offset) {
                                  return { ...hl, location_start: offset.start, location_end: offset.end };
                                }
                              }
                            }
                            return hl;
                          });
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

                        window.scrollToHighlight = function(hlId) {
                          try {
                            const mark = document.querySelector('mark[data-highlight-id="' + hlId + '"]');
                            if (mark) {
                              const containerRect = document.body.getBoundingClientRect();
                              const elementRect = mark.getBoundingClientRect();
                              const relativeTop = elementRect.top - containerRect.top;
                              const targetScrollTop = relativeTop - (window.innerHeight / 2) + (elementRect.height / 2);
                              window.scrollTo({
                                top: targetScrollTop,
                                behavior: 'smooth'
                              });
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
                            if (hl.location_start == null || hl.location_end == null) {
                              if (hl.text) {
                                const offset = findFuzzyOffset(fullText, hl.text);
                                if (offset) {
                                  return { ...hl, location_start: offset.start, location_end: offset.end };
                                }
                              }
                            }
                            return hl;
                          });
                          // 执行 DOM 渲染（与原逻辑一致）
                          restoreHighlights(root, highlights);
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

                        if (window.AndroidBridge && typeof window.AndroidBridge.onPageReady === 'function') {
                          window.AndroidBridge.onPageReady();
                        }
                        // 恢复阅读进度位置
                        (function() {
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
            val text = trimmed.drop(level).trim()
            sb.append("<h$level>$text</h$level>\n")
        } else if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
            if (!inList) { sb.append("</ul>\n"); inList = true }
            val text = trimmed.drop(1).trim()
            sb.append("<li>$text</li>\n")
        } else if (trimmed.isEmpty()) {
            if (inList) { sb.append("</ul>\n"); inList = false }
            sb.append("<br/>\n")
        } else {
            if (inList) { sb.append("</ul>\n"); inList = false }
            sb.append("<p>$trimmed</p>\n")
        }
    }
    if (inList) sb.append("</ul>\n")
    html = sb.toString()
    
    html = html.replace(Regex("\\*\\*(.*?)\\*\\*"), "<strong>$1</strong>")
    html = html.replace(Regex("\\*(.*?)\\*"), "<em>$1</em>")
    html = html.replace(Regex("\\[(.*?)\\]\\((.*?)\\)"), "<a href=\"$2\">$1</a>")
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
    articleContent: @Composable (Modifier) -> Unit,
    modifier: Modifier = Modifier
) {
    val subtitles by viewModel.subtitles.collectAsState()
    val subtitleLoading by viewModel.subtitleLoading.collectAsState()
    val context = LocalContext.current
    var selectedTab by remember { mutableStateOf(if (subtitles.isNotEmpty()) "字幕" else "博客") }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var currentTime by remember { mutableStateOf(0f) }

    // 监听高亮卡片点击跳转事件，如果是视频文档，自动切换到 "博客" Tab
    LaunchedEffect(viewModel) {
        viewModel.scrollToHighlightEvent.collect {
            selectedTab = "博客"
        }
    }

    // 从 source_url 提取 YouTube 视频 ID
    val videoId = remember(doc.source_url, doc.url) {
        extractYouTubeVideoId(doc.source_url ?: doc.url)
    }

    Column(
        modifier = modifier.fillMaxSize()
    ) {
        // YouTube 播放器区域
        if (videoId != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(16f / 9f)
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
                            
                            // 借鉴桌面版思路：移除 User-Agent 中的 "wv" 标识，防止 Google 阻断 WebView
                            val defaultUa = settings.userAgentString
                            settings.userAgentString = defaultUa.replace("; wv", "")
                            
                            webViewClient = WebViewClient()
                            webChromeClient = android.webkit.WebChromeClient()
                            
                            // 开启 GPU 硬件加速以支持 HTML5 / YouTube 视频 Surface 贴图渲染，防止黑屏
                            setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
                            
                            addJavascriptInterface(object : Any() {
                                @android.webkit.JavascriptInterface
                                fun updateTime(time: Float) {
                                    currentTime = time
                                }
                            }, "AndroidApp")
                        }
                    },
                    modifier = Modifier.fillMaxSize().alpha(0.99f)
                )
                
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
                                function seekTo(time) {
                                    if (player && typeof player.seekTo === 'function') {
                                        player.seekTo(time, true);
                                    }
                                }
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
            // 无法识别视频 ID
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

        // TabRow
        val isDark = MaterialTheme.colorScheme.background.luminance() < 0.5f
        androidx.compose.material3.TabRow(
            selectedTabIndex = if (selectedTab == "字幕") 0 else 1,
            containerColor = if (isDark) Color(0xFF16162A) else Color(0xFFEEEFF5),
            contentColor = MaterialTheme.colorScheme.primary,
            indicator = { tabPositions ->
                androidx.compose.material3.TabRowDefaults.Indicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[if (selectedTab == "字幕") 0 else 1]),
                    color = MaterialTheme.colorScheme.primary
                )
            }
        ) {
            androidx.compose.material3.Tab(
                selected = selectedTab == "字幕",
                onClick = { selectedTab = "字幕" },
                text = { Text("字幕", fontWeight = if (selectedTab == "字幕") FontWeight.Bold else FontWeight.Normal) }
            )
            androidx.compose.material3.Tab(
                selected = selectedTab == "博客",
                onClick = { selectedTab = "博客" },
                text = { Text("博客", fontWeight = if (selectedTab == "博客") FontWeight.Bold else FontWeight.Normal) }
            )
        }

        // 面板区域
        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
            // 博客
            articleContent(
                if (selectedTab == "博客") Modifier.fillMaxSize() else Modifier.height(0.dp)
            )
            
            // 字幕
            if (selectedTab == "字幕") {
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
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(if (isDark) Color(0xFF16162A) else Color(0xFFEEEFF5))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "字幕",
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = textColor
            )

            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                // 上传按钮
                Surface(
                    onClick = { srtPickerLauncher.launch("*/*") },
                    shape = RoundedCornerShape(6.dp),
                    color = accentColor.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = if (subtitles.isEmpty()) "上传 SRT" else "替换",
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        fontSize = 12.sp,
                        color = accentColor,
                        fontWeight = FontWeight.Medium
                    )
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
                        Text(
                            text = "删除",
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            fontSize = 12.sp,
                            color = Color(0xFFEF4444),
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }

        Divider(color = borderColor, thickness = 0.5.dp)

        // 字幕内容
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = accentColor,
                    strokeWidth = 2.dp
                )
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
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                items(subtitles.size) { index ->
                    val segment = subtitles[index]
                    val isActive = index == activeIndex
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (isActive) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f) else Color.Transparent)
                            .clickable { onSeekTo?.invoke(segment.startTime.toFloat()) }
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = com.readerq.app.api.SrtParser.formatTime(segment.startTime),
                            fontSize = 11.sp,
                            color = if (isActive) MaterialTheme.colorScheme.primary else accentColor,
                            fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                            modifier = Modifier.width(40.dp)
                        )
                        Text(
                            text = segment.text,
                            fontSize = 13.sp,
                            color = if (isActive) MaterialTheme.colorScheme.primary else textColor.copy(alpha = 0.85f),
                            lineHeight = 18.sp,
                            fontWeight = if (isActive) FontWeight.Medium else FontWeight.Normal
                        )
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
