package com.readerq.app.ui

import android.annotation.SuppressLint
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReadingPane(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null
) {
    val doc by viewModel.selectedDoc.collectAsState()
    val highlights by viewModel.highlights.collectAsState()

    val theme by viewModel.theme.collectAsState()
    val fontSize by viewModel.fontSize.collectAsState()
    val fontFamily by viewModel.fontFamily.collectAsState()
    val lineHeight by viewModel.lineHeight.collectAsState()
    val contentWidth by viewModel.contentWidth.collectAsState()

    var selectedTextForHighlight by remember { mutableStateOf<String?>(null) }
    var selectedImagesForHighlight by remember { mutableStateOf<List<HighlightImage>>(emptyList()) }
    var showHighlightCreator by remember { mutableStateOf(false) }

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
                    }
                },
                actions = {
                    // Aa Typesetting Setting Icon
                    IconButton(onClick = { showAaSheet = true }) {
                        Text("Aa", fontSize = 16.sp, color = textColor, fontWeight = FontWeight.Bold)
                    }
                    // Notebook Highlights Icon
                    IconButton(onClick = { showNotebookSheet = true }) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_tab_notebook),
                            contentDescription = "Notebook Highlights",
                            tint = textColor,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    // AI Assistant Icon
                    IconButton(onClick = { showAiSheet = true }) {
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
                                text = { Text("元数据关于") },
                                onClick = {
                                    showOverflowMenu = false
                                    showInfoSheet = true
                                }
                            )
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
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = appBarBg
                )
            )

            // WebView container
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                // Render WebView content
                HtmlContentViewer(
                    html = currentDoc.html_content ?: "加载中...",
                    highlights = highlights,
                    theme = theme,
                    fontFamily = fontFamily,
                    fontSize = fontSize,
                    lineHeight = lineHeight,
                    contentWidth = contentWidth,
                    onTextSelected = { text, images ->
                        selectedTextForHighlight = text
                        selectedImagesForHighlight = images
                        showHighlightCreator = true
                    }
                )

                // Highlight Floating dialog
                if (showHighlightCreator && !selectedTextForHighlight.isNullOrBlank()) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(16.dp)
                            .fillMaxWidth()
                            .border(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("新建高亮", fontWeight = FontWeight.Bold, color = textColor, fontSize = 14.sp)
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
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text("排版与外观", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    
                    // Theme picker
                    Text("主题色", fontSize = 12.sp, color = Color.Gray)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        listOf(
                            Triple("light", "明亮", Color(0xFFFCFCFA) to Color(0xFF1A1A1A)),
                            Triple("sepia", "复古米黄", Color(0xFFF4F1EB) to Color(0xFF2B251F)),
                            Triple("dark", "沉浸深色", Color(0xFF121212) to Color(0xFFE5E7EB))
                        ).forEach { (key, label, colors) ->
                            val bgCol = colors.first
                            val fgCol = colors.second
                            val isSelected = theme == key
                            
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(bgCol)
                                    .border(
                                        width = if (isSelected) 2.dp else 1.dp,
                                        color = if (isSelected) MaterialTheme.colorScheme.primary else Color.Gray.copy(alpha = 0.3f),
                                        shape = RoundedCornerShape(8.dp)
                                    )
                                    .clickable { viewModel.setTheme(key) },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(label, color = fgCol, fontSize = 13.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal)
                            }
                        }
                    }
                    
                    Divider(color = Color.Gray.copy(alpha = 0.15f))
                    
                    // Font Size: [-] size [+]
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("字号选择", fontSize = 12.sp, color = Color.Gray)
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            IconButton(
                                onClick = { viewModel.saveAppearanceSettings(fontFamily, (fontSize - 1).coerceAtLeast(12), lineHeight, contentWidth) },
                                modifier = Modifier.border(1.dp, Color.Gray.copy(alpha = 0.3f), RoundedCornerShape(4.dp)).size(36.dp)
                            ) {
                                Text("A-", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                            Text(text = "$fontSize", fontWeight = FontWeight.Bold)
                            IconButton(
                                onClick = { viewModel.saveAppearanceSettings(fontFamily, (fontSize + 1).coerceAtMost(32), lineHeight, contentWidth) },
                                modifier = Modifier.border(1.dp, Color.Gray.copy(alpha = 0.3f), RoundedCornerShape(4.dp)).size(36.dp)
                            ) {
                                Text("A+", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                    
                    Divider(color = Color.Gray.copy(alpha = 0.15f))

                    // Font Family: Sans vs Serif
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("正文字体", fontSize = 12.sp, color = Color.Gray)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("sans" to "无衬线 (Sans)", "serif" to "有衬线 (Serif)").forEach { (key, label) ->
                                val isSelected = fontFamily == key
                                Button(
                                    onClick = { viewModel.saveAppearanceSettings(key, fontSize, lineHeight, contentWidth) },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (isSelected) MaterialTheme.colorScheme.primary else Color.Transparent,
                                        contentColor = if (isSelected) MaterialTheme.colorScheme.onPrimary else textColor
                                    ),
                                    border = BorderStroke(1.dp, if (isSelected) Color.Transparent else Color.Gray.copy(alpha = 0.3f)),
                                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                                    modifier = Modifier.height(34.dp)
                                ) {
                                    Text(label, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(12.dp))
                }
            }
        }

        // --- BottomSheet 2: Notebook Highlights browser ---
        if (showNotebookSheet) {
            ModalBottomSheet(
                onDismissRequest = { showNotebookSheet = false },
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = textColor
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .fillMaxHeight(0.75f)
                        .padding(16.dp)
                ) {
                    Text(
                        "高亮与批注 (${highlights.size})",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = textColor,
                        modifier = Modifier.padding(bottom = 12.dp, start = 8.dp)
                    )
                    Divider(color = Color.Gray.copy(alpha = 0.15f))
                    Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                        NotebookView(viewModel = viewModel)
                    }
                }
            }
        }

        // --- BottomSheet 3: AI Assistant Dialogue ---
        if (showAiSheet) {
            ModalBottomSheet(
                onDismissRequest = { showAiSheet = false },
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = textColor
            ) {
                val chatHistories by viewModel.chatHistories.collectAsState()
                val messages = chatHistories[currentDoc.id] ?: emptyList()
                var messageInput by remember { mutableStateOf("") }
                var isSending by remember { mutableStateOf(false) }
                var sendError by remember { mutableStateOf<String?>(null) }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .fillMaxHeight(0.8f)
                        .padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("GhostReader AI 助手", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = textColor)
                        TextButton(onClick = { viewModel.clearChatHistory(currentDoc.id) }) {
                            Text("清空对话", color = Color.Gray, fontSize = 12.sp)
                        }
                    }
                    
                    Divider(color = Color.Gray.copy(alpha = 0.15f), modifier = Modifier.padding(vertical = 8.dp))

                    // Message history
                    Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                        if (messages.isEmpty()) {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text("向 GhostReader 提问关于这篇文档的任何问题...", color = Color.Gray, fontSize = 13.sp)
                            }
                        } else {
                            androidx.compose.foundation.lazy.LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                items(messages) { msg ->
                                    val isUser = msg.role == "user"
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
                                    ) {
                                        Card(
                                            colors = CardDefaults.cardColors(
                                                containerColor = if (isUser) MaterialTheme.colorScheme.primary else (if (theme == "dark") Color(0xFF242424) else Color(0x0A000000))
                                            ),
                                            shape = RoundedCornerShape(12.dp)
                                        ) {
                                            Column(modifier = Modifier.padding(12.dp)) {
                                                Text(
                                                    text = msg.content,
                                                    color = if (isUser) MaterialTheme.colorScheme.onPrimary else textColor,
                                                    fontSize = 13.sp
                                                )
                                            }
                                        }
                                    }
                                }
                                if (isSending) {
                                    item {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.Start
                                        ) {
                                            Card(
                                                colors = CardDefaults.cardColors(containerColor = if (theme == "dark") Color(0xFF242424) else Color(0x0A000000)),
                                                shape = RoundedCornerShape(12.dp)
                                            ) {
                                                Box(modifier = Modifier.padding(12.dp)) {
                                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    if (sendError != null) {
                        Text(sendError!!, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                        Spacer(modifier = Modifier.height(4.dp))
                    }

                    // Input bar
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = messageInput,
                            onValueChange = { messageInput = it },
                            placeholder = { Text("输入您的问题...", fontSize = 13.sp) },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                if (messageInput.isNotBlank()) {
                                    isSending = true
                                    sendError = null
                                    val query = messageInput
                                    messageInput = ""
                                    viewModel.sendChatMessage(
                                        docId = currentDoc.id,
                                        text = query,
                                        onResponse = { isSending = false },
                                        onError = {
                                            sendError = it
                                            isSending = false
                                        }
                                    )
                                }
                            },
                            enabled = messageInput.isNotBlank() && !isSending
                        ) {
                            Text("发送", fontSize = 13.sp)
                        }
                    }
                }
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
    onTextSelected: (String, List<HighlightImage>) -> Unit
) {
    val highlightsJson = highlights.joinToString(separator = ",", prefix = "[", postfix = "]") { hl ->
        val escapedText = hl.text.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "")
        val escapedNote = hl.note?.replace("\\", "\\\\")?.replace("\"", "\\\"")?.replace("\n", "\\n")?.replace("\r", "") ?: ""
        val color = hl.color ?: "yellow"
        """{"id":"${hl.id}","text":"$escapedText","note":"$escapedNote","color":"$color","location_start":${hl.location}}"""
    }

    AndroidView(
        factory = { context ->
            WebView(context).apply {
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
                                    "  var sel = window.getSelection(); " +
                                    "  if (!sel.isCollapsed && sel.rangeCount > 0) { " +
                                    "    var range = sel.getRangeAt(0); " +
                                    "    var text = extractSelectionText(range); " +
                                    "    var images = extractImagesFromRange(range); " +
                                    "    if (text.trim().length > 0 || images.length > 0) { " +
                                    "      AndroidBridge.onTextSelected(text, JSON.stringify(images)); " +
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
                        padding: 20px;
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
                </style>
                </head>
                <body>
                    $html
                    
                    <script>
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
                                  middle.parentNode.replaceChild(mark, middle);
                                  mark.style.cursor = 'pointer';
                                }
                              });
                            }
                          }
                        }

                        setTimeout(() => {
                          try {
                            const highlights = $highlightsJson;
                            restoreHighlights(document.body, highlights);
                          } catch(e) {
                            console.error("Failed to restore highlights:", e);
                          }
                        }, 50);
                    </script>
                </body>
                </html>
            """.trimIndent()

            webView.loadDataWithBaseURL(null, styledHtml, "text/html", "UTF-8", null)
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

@Composable
fun MetadataRow(label: String, value: String) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(text = label, color = Color.Gray, fontSize = 11.sp)
        Spacer(modifier = Modifier.height(2.dp))
        Text(text = value, color = MaterialTheme.colorScheme.onBackground, fontSize = 13.sp)
        Divider(color = Color.Gray.copy(alpha = 0.15f), modifier = Modifier.padding(top = 8.dp))
    }
}
