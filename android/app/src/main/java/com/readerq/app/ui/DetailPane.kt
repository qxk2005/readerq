package com.readerq.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun DetailPane(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier
) {
    val detailPaneType by viewModel.detailPaneType.collectAsState()
    val doc by viewModel.selectedDoc.collectAsState()
    val theme by viewModel.theme.collectAsState()
    val fontSize by viewModel.fontSize.collectAsState()
    val fontFamily by viewModel.fontFamily.collectAsState()
    val lineHeight by viewModel.lineHeight.collectAsState()
    val contentWidth by viewModel.contentWidth.collectAsState()
    
    val textColor = MaterialTheme.colorScheme.onBackground
    val cardBg = when (theme) {
        "light" -> Color(0xFFFCFCFA)
        "sepia" -> Color(0xFFF4F1EB)
        else -> Color(0xFF121212)
    }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = cardBg,
        contentColor = textColor
    ) {
        doc?.let { currentDoc ->
            when (detailPaneType) {
                "aa" -> {
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
                "notebook" -> {
                    NotebookView(viewModel = viewModel)
                }
                "ai" -> {
                    AiAssistantContent(
                        viewModel = viewModel,
                        docId = currentDoc.id,
                        theme = theme,
                        textColor = textColor
                    )
                }
            }
        } ?: Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("没有选择的文档")
        }
    }
}

@Composable
fun AppearanceSettingsContent(
    viewModel: MainViewModel,
    theme: String,
    fontSize: Int,
    fontFamily: String,
    lineHeight: Float,
    contentWidth: Int,
    textColor: Color
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
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
    }
}

@Composable
fun AiAssistantContent(
    viewModel: MainViewModel,
    docId: String,
    theme: String,
    textColor: Color
) {
    val chatHistories by viewModel.chatHistories.collectAsState()
    val messages = chatHistories[docId] ?: emptyList()
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
            Text("GhostReader AI 助手", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = textColor)
            TextButton(onClick = { viewModel.clearChatHistory(docId) }) {
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
                LazyColumn(
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
                            docId = docId,
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
