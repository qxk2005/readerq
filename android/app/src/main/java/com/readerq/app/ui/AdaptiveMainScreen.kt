package com.readerq.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

@Composable
fun AdaptiveMainScreen(
    viewModel: MainViewModel,
    windowSizeClass: WindowSizeClass
) {
    val selectedDoc by viewModel.selectedDoc.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val syncError by viewModel.syncError.collectAsState()
    val token by viewModel.token.collectAsState()

    var showSettings by remember { mutableStateOf(false) }

    // Observe theme setting from viewModel
    val theme by viewModel.theme.collectAsState()
    val isDark = theme == "dark"

    MaterialTheme(
        colorScheme = if (isDark) {
            darkColorScheme(
                background = Color(0xFF121212),
                surface = Color(0xFF1E1E1E),
                primary = Color(0xFF6366F1), // Indigo accent
                onBackground = Color(0xFFE5E7EB),
                onSurface = Color(0xFFF3F4F6)
            )
        } else {
            lightColorScheme(
                background = Color(0xFFF9FAFB),
                surface = Color(0xFFFFFFFF),
                primary = Color(0xFF4F46E5), // Light Indigo accent
                onBackground = Color(0xFF111827),
                onSurface = Color(0xFF1F2937)
            )
        }
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            val isCompact = windowSizeClass.widthSizeClass == WindowWidthSizeClass.Compact

            // Wrap readingPane and documentListPane as movableContentOf so that they keep their state
            // and views (WebView) when they move in the Composable tree during layout transitions (e.g. folding/unfolding)
            val documentListPane = remember(viewModel) {
                movableContentOf { modifier: Modifier ->
                    DocumentListPane(
                        viewModel = viewModel,
                        onOpenSettings = { showSettings = true }
                    )
                }
            }

            val readingPane = remember(viewModel) {
                movableContentOf { modifier: Modifier, onBack: (() -> Unit)? ->
                    ReadingPane(
                        viewModel = viewModel,
                        modifier = modifier,
                        onBack = onBack
                    )
                }
            }

            if (isCompact) {
                // --- Single Pane layout (Outer Screen / Narrow view) ---
                if (selectedDoc == null) {
                    documentListPane(Modifier.fillMaxSize())
                } else {
                    BackHandler {
                        viewModel.selectDocument(null)
                    }
                    Row(Modifier.fillMaxSize()) {
                        readingPane(Modifier.fillMaxSize()) { viewModel.selectDocument(null) }
                    }
                }
            } else {
                // --- Dual Pane layout (Folded Unfolded / Foldable Screen / Wide view) ---
                Row(Modifier.fillMaxSize()) {
                    // Left Pane: List of items
                    Box(modifier = Modifier.width(360.dp)) {
                        documentListPane(Modifier.fillMaxSize())
                    }
                    
                    // Divider
                    Divider(modifier = Modifier.width(1.dp).fillMaxHeight(), color = Color(0xFF2D2D2D))

                    // Right Pane: Content Reader
                    Box(modifier = Modifier.weight(1f)) {
                        if (selectedDoc != null) {
                            readingPane(Modifier.fillMaxSize(), null)
                        } else {
                            // Placeholder
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color(0xFF151515)),
                                contentAlignment = androidx.compose.ui.Alignment.Center
                            ) {
                                Text(
                                    text = "选择一篇文章开始阅读",
                                    color = Color(0xFF6B7280),
                                    style = MaterialTheme.typography.bodyLarge
                                )
                            }
                        }
                    }
                }
            }

            // Settings Sheet
            if (showSettings || token.isNullOrBlank()) {
                SettingsDialog(
                    viewModel = viewModel,
                    onDismiss = {
                        if (!token.isNullOrBlank()) {
                            showSettings = false
                        }
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsDialog(
    viewModel: MainViewModel,
    onDismiss: () -> Unit
) {
    val token by viewModel.token.collectAsState()
    val openaiApiKey by viewModel.openaiApiKey.collectAsState()
    val openaiBaseUrl by viewModel.openaiBaseUrl.collectAsState()
    val openaiModel by viewModel.openaiModel.collectAsState()

    val ossRegion by viewModel.ossRegion.collectAsState()
    val ossBucket by viewModel.ossBucket.collectAsState()
    val ossAccessKeyId by viewModel.ossAccessKeyId.collectAsState()
    val ossAccessKeySecret by viewModel.ossAccessKeySecret.collectAsState()
    val ossCustomDomain by viewModel.ossCustomDomain.collectAsState()
    val ossPathPrefix by viewModel.ossPathPrefix.collectAsState()

    var activeTab by remember { mutableStateOf("readwise") }

    // States for inputs
    var tokenInput by remember(token) { mutableStateOf(token ?: "") }
    var openaiApiKeyInput by remember(openaiApiKey) { mutableStateOf(openaiApiKey) }
    var openaiBaseUrlInput by remember(openaiBaseUrl) { mutableStateOf(openaiBaseUrl) }
    var openaiModelInput by remember(openaiModel) { mutableStateOf(openaiModel) }

    var ossRegionInput by remember(ossRegion) { mutableStateOf(ossRegion) }
    var ossBucketInput by remember(ossBucket) { mutableStateOf(ossBucket) }
    var ossAccessKeyIdInput by remember(ossAccessKeyId) { mutableStateOf(ossAccessKeyId) }
    var ossAccessKeySecretInput by remember(ossAccessKeySecret) { mutableStateOf(ossAccessKeySecret) }
    var ossCustomDomainInput by remember(ossCustomDomain) { mutableStateOf(ossCustomDomain) }
    var ossPathPrefixInput by remember(ossPathPrefix) { mutableStateOf(ossPathPrefix) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("系统设置", fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                TabRow(
                    selectedTabIndex = when(activeTab) {
                        "readwise" -> 0
                        "openai" -> 1
                        "oss" -> 2
                        else -> 0
                    },
                    containerColor = Color.Transparent
                ) {
                    Tab(
                        selected = activeTab == "readwise",
                        onClick = { activeTab = "readwise" },
                        text = { Text("同步", fontSize = 12.sp) }
                    )
                    Tab(
                        selected = activeTab == "openai",
                        onClick = { activeTab = "openai" },
                        text = { Text("AI 助手", fontSize = 12.sp) }
                    )
                    Tab(
                        selected = activeTab == "oss",
                        onClick = { activeTab = "oss" },
                        text = { Text("图床", fontSize = 12.sp) }
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))

                Box(modifier = Modifier.weight(1f, fill = false)) {
                    when (activeTab) {
                        "readwise" -> {
                            Column {
                                Text(
                                    "请配置您的 Readwise V2/V3 Token，或使用纯本地离线模式。",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color.LightGray
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                OutlinedTextField(
                                    value = tokenInput,
                                    onValueChange = { tokenInput = it },
                                    label = { Text("Readwise Token") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                        "openai" -> {
                            Column {
                                Text(
                                    "配置 OpenAI 兼容的 API 服务以启用 GhostReader AI 助手。",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color.LightGray
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                OutlinedTextField(
                                    value = openaiApiKeyInput,
                                    onValueChange = { openaiApiKeyInput = it },
                                    label = { Text("API Key") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = openaiBaseUrlInput,
                                    onValueChange = { openaiBaseUrlInput = it },
                                    label = { Text("API Base URL") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = openaiModelInput,
                                    onValueChange = { openaiModelInput = it },
                                    label = { Text("AI Model") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                        "oss" -> {
                            Column {
                                Text(
                                    "配置阿里云 OSS 服务，用于高亮中的图片离线转存。",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color.LightGray
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                OutlinedTextField(
                                    value = ossRegionInput,
                                    onValueChange = { ossRegionInput = it },
                                    label = { Text("OSS Region (如 oss-cn-hangzhou)") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = ossBucketInput,
                                    onValueChange = { ossBucketInput = it },
                                    label = { Text("Bucket") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = ossAccessKeyIdInput,
                                    onValueChange = { ossAccessKeyIdInput = it },
                                    label = { Text("AccessKey ID") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = ossAccessKeySecretInput,
                                    onValueChange = { ossAccessKeySecretInput = it },
                                    label = { Text("AccessKey Secret") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = ossCustomDomainInput,
                                    onValueChange = { ossCustomDomainInput = it },
                                    label = { Text("自定义域名 (可选)") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = ossPathPrefixInput,
                                    onValueChange = { ossPathPrefixInput = it },
                                    label = { Text("路径前缀 (如 readerq)") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    viewModel.saveToken(tokenInput)
                    viewModel.saveOpenAiSettings(openaiApiKeyInput, openaiBaseUrlInput, openaiModelInput)
                    viewModel.saveOssSettings(
                        ossRegionInput,
                        ossBucketInput,
                        ossAccessKeyIdInput,
                        ossAccessKeySecretInput,
                        ossCustomDomainInput,
                        ossPathPrefixInput
                    )
                    onDismiss()
                },
                enabled = when (activeTab) {
                    "readwise" -> tokenInput.isNotBlank()
                    else -> true
                }
            ) {
                Text("保存")
            }
        },
        dismissButton = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                if (activeTab == "readwise") {
                    TextButton(onClick = { 
                        viewModel.saveToken("offline")
                        onDismiss()
                    }) {
                        Text("使用离线模式", color = MaterialTheme.colorScheme.primary)
                    }
                }
                if (!token.isNullOrBlank()) {
                    Spacer(modifier = Modifier.width(8.dp))
                    TextButton(onClick = onDismiss) {
                        Text("取消", color = Color.Gray)
                    }
                }
            }
        }
    )
}
