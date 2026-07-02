package com.readerq.app.ui

import android.annotation.SuppressLint
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.readerq.app.data.DocumentEntity
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

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

    var activeTab by remember { mutableStateOf("content") } // content, notebook, info, ai
    var selectedTextForHighlight by remember { mutableStateOf<String?>(null) }
    var showHighlightCreator by remember { mutableStateOf(false) }

    var showAiDialog by remember { mutableStateOf(false) }
    var aiCommandType by remember { mutableStateOf("") }
    var aiCommandText by remember { mutableStateOf("") }

    doc?.let { currentDoc ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .background(if (theme == "dark") Color(0xFF121212) else Color(0xFFFFFFFF))
        ) {
            // Document Top Bar
            TopAppBar(
                title = {
                    Text(
                        text = currentDoc.title,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        fontSize = 16.sp,
                        color = Color.White
                    )
                },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(
                                imageVector = Icons.Default.ArrowBack,
                                contentDescription = "Back",
                                tint = Color.White
                            )
                        }
                    }
                },
                actions = {
                    // Navigation Tabs
                    TextButton(onClick = { activeTab = "content" }) {
                        Text(
                            "正文",
                            color = if (activeTab == "content") MaterialTheme.colorScheme.primary else Color.Gray,
                            fontWeight = if (activeTab == "content") FontWeight.Bold else FontWeight.Normal
                        )
                    }
                    TextButton(onClick = { activeTab = "notebook" }) {
                        Text(
                            "笔记 (${highlights.size})",
                            color = if (activeTab == "notebook") MaterialTheme.colorScheme.primary else Color.Gray,
                            fontWeight = if (activeTab == "notebook") FontWeight.Bold else FontWeight.Normal
                        )
                    }
                    TextButton(onClick = { activeTab = "info" }) {
                        Text(
                            "关于",
                            color = if (activeTab == "info") MaterialTheme.colorScheme.primary else Color.Gray,
                            fontWeight = if (activeTab == "info") FontWeight.Bold else FontWeight.Normal
                        )
                    }
                    TextButton(onClick = { activeTab = "ai" }) {
                        Text(
                            "AI 助手",
                            color = if (activeTab == "ai") MaterialTheme.colorScheme.primary else Color.Gray,
                            fontWeight = if (activeTab == "ai") FontWeight.Bold else FontWeight.Normal
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF1E1E1E)
                )
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                when (activeTab) {
                    "content" -> {
                        // Render WebView content
                        HtmlContentViewer(
                            html = currentDoc.html_content ?: "加载中...",
                            highlights = highlights.map { it.text },
                            theme = theme,
                            fontFamily = fontFamily,
                            fontSize = fontSize,
                            lineHeight = lineHeight,
                            contentWidth = contentWidth,
                            onTextSelected = { text ->
                                selectedTextForHighlight = text
                                showHighlightCreator = true
                            }
                        )

                        // Highlight Floating dialog
                        if (showHighlightCreator && !selectedTextForHighlight.isNullOrBlank()) {
                            Card(
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF242424)),
                                modifier = Modifier
                                    .align(Alignment.BottomCenter)
                                    .padding(16.dp)
                                    .fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text("新建高亮", fontWeight = FontWeight.Bold, color = Color.White)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        "\"${selectedTextForHighlight}\"",
                                        color = Color.LightGray,
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
                                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                            modifier = Modifier.height(32.dp)
                                        ) {
                                            Text("翻译", fontSize = 12.sp, color = Color.White)
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
                                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                            modifier = Modifier.height(32.dp)
                                        ) {
                                            Text("解释", fontSize = 12.sp, color = Color.White)
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
                                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                            modifier = Modifier.height(32.dp)
                                        ) {
                                            Text("简化", fontSize = 12.sp, color = Color.White)
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(12.dp))
                                    
                                    // Actions
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        // Colors picker
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
                                                            color = colorName
                                                        )
                                                        showHighlightCreator = false
                                                        selectedTextForHighlight = null
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
                                        }) {
                                            Text("取消", color = Color.Gray)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "notebook" -> {
                        NotebookView(viewModel = viewModel)
                    }

                    "info" -> {
                        DocumentInfoView(currentDoc)
                    }

                    "ai" -> {
                        val chatHistories by viewModel.chatHistories.collectAsState()
                        val messages = chatHistories[currentDoc.id] ?: emptyList()
                        var messageInput by remember { mutableStateOf("") }
                        var isSending by remember { mutableStateOf(false) }
                        var sendError by remember { mutableStateOf<String?>(null) }

                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(16.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("与文档对话 (GhostReader)", fontWeight = FontWeight.Bold, color = Color.White)
                                TextButton(onClick = { viewModel.clearChatHistory(currentDoc.id) }) {
                                    Text("清空对话", color = Color.Gray)
                                }
                            }
                            
                            Spacer(modifier = Modifier.height(8.dp))

                            // Message history
                            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                                if (messages.isEmpty()) {
                                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                        Text("向 GhostReader 提问关于这篇文档的任何问题...", color = Color.Gray, fontSize = 14.sp)
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
                                                        containerColor = if (isUser) MaterialTheme.colorScheme.primary else Color(0xFF242424)
                                                    ),
                                                    shape = RoundedCornerShape(12.dp)
                                                ) {
                                                    Column(modifier = Modifier.padding(12.dp)) {
                                                        Text(
                                                            text = msg.content,
                                                            color = Color.White,
                                                            fontSize = 14.sp
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
                                                        colors = CardDefaults.cardColors(containerColor = Color(0xFF242424)),
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
                                    placeholder = { Text("输入您的问题...", fontSize = 14.sp) },
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
                                    Text("发送")
                                }
                            }
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
                        Text("\"$aiCommandText\"", color = Color.LightGray, fontSize = 14.sp)
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
                            Text(aiResponse ?: "暂无回复", color = Color.White, fontSize = 14.sp)
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
    highlights: List<String>,
    theme: String,
    fontFamily: String,
    fontSize: Int,
    lineHeight: Float,
    contentWidth: Int,
    onTextSelected: (String) -> Unit
) {
    AndroidView(
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        // Inject highlighting javascript triggers
                        view?.loadUrl(
                            "javascript:(function() { " +
                                    "document.addEventListener('selectionchange', () => { " +
                                    "  var sel = window.getSelection(); " +
                                    "  if (!sel.isCollapsed && sel.toString().trim().length > 0) { " +
                                    "    AndroidBridge.onTextSelected(sel.toString()); " +
                                    "  } " +
                                    "}); " +
                                    "})()"
                        )
                    }
                }
                
                // Expose AndroidBridge
                addJavascriptInterface(object {
                    @JavascriptInterface
                    fun onTextSelected(text: String) {
                        post {
                            onTextSelected(text)
                        }
                    }
                }, "AndroidBridge")
            }
        },
        update = { webView ->
            // Re-render gorgeous reading stylesheet and document body
            val styledHtml = """
                <html>
                <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
                <style>
                    body {
                        background-color: ${if (theme == "dark") "#121212" else "#FFFFFF"};
                        color: ${if (theme == "dark") "#E5E7EB" else "#111827"};
                        font-family: ${if (fontFamily == "serif") "Georgia, Cambria, 'Times New Roman', Times, serif" else "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"};
                        line-height: $lineHeight;
                        font-size: ${fontSize}px;
                        max-width: ${contentWidth}px;
                        margin: 0 auto;
                        padding: 16px;
                    }
                    a { color: #6366F1; text-decoration: none; }
                    img { max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; }
                    blockquote { border-left: 4px solid #4B5563; padding-left: 12px; color: #9CA3AF; margin: 16px 0; }
                    pre, code { background-color: #1F2937; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px; }
                </style>
                </head>
                <body>
                    $html
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
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("文档元数据", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color.White)
        
        Spacer(modifier = Modifier.height(8.dp))
        
        MetadataRow(label = "标题", value = doc.title)
        MetadataRow(label = "作者", value = doc.author ?: "未知")
        MetadataRow(label = "分类", value = doc.category ?: "默认分类")
        MetadataRow(label = "出处", value = doc.site_name ?: "本地导入")
        MetadataRow(label = "源链接", value = doc.source_url ?: doc.url)
        MetadataRow(label = "字数", value = doc.word_count?.toString() ?: "未知")
        MetadataRow(label = "阅读时长", value = doc.reading_time ?: "少于 1 分钟")
    }
}

@Composable
fun MetadataRow(label: String, value: String) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(text = label, color = Color.Gray, fontSize = 12.sp)
        Text(text = value, color = Color.LightGray, fontSize = 14.sp)
        Divider(color = Color(0xFF2D2D2D), modifier = Modifier.padding(top = 8.dp))
    }
}
