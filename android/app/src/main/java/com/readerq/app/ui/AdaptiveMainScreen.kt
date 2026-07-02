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

    // Use dark theme palette for high premium design
    MaterialTheme(
        colorScheme = darkColorScheme(
            background = Color(0xFF121212),
            surface = Color(0xFF1E1E1E),
            primary = Color(0xFF6366F1), // Indigo accent
            onBackground = Color(0xFFE5E7EB),
            onSurface = Color(0xFFF3F4F6)
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            val isCompact = windowSizeClass.widthSizeClass == WindowWidthSizeClass.Compact

            if (isCompact) {
                // --- Single Pane layout (Outer Screen / Narrow view) ---
                if (selectedDoc == null) {
                    DocumentListPane(
                        viewModel = viewModel,
                        onOpenSettings = { showSettings = true }
                    )
                } else {
                    BackHandler {
                        viewModel.selectDocument(null)
                    }
                    Row(Modifier.fillMaxSize()) {
                        ReadingPane(
                            viewModel = viewModel,
                            modifier = Modifier.fillMaxSize(),
                            onBack = { viewModel.selectDocument(null) }
                        )
                    }
                }
            } else {
                // --- Dual Pane layout (Folded Unfolded / Foldable Screen / Wide view) ---
                Row(Modifier.fillMaxSize()) {
                    // Left Pane: List of items
                    Box(modifier = Modifier.width(360.dp)) {
                        DocumentListPane(
                            viewModel = viewModel,
                            onOpenSettings = { showSettings = true }
                        )
                    }
                    
                    // Divider
                    VerticalDivider(color = Color(0xFF2D2D2D))

                    // Right Pane: Content Reader
                    Box(modifier = Modifier.weight(1f)) {
                        if (selectedDoc != null) {
                            ReadingPane(
                                viewModel = viewModel,
                                modifier = Modifier.fillMaxSize(),
                                onBack = null // back button not needed in split pane
                            )
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
                    token = token ?: "",
                    onSave = {
                        viewModel.saveToken(it)
                        showSettings = false
                    },
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

@Composable
fun SettingsDialog(
    token: String,
    onSave: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var textState by remember { mutableStateOf(token) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("配置 Readwise Token") },
        text = {
            Column {
                Text(
                    "请配置您的 Readwise V2/V3 Token。该 Token 仅保存在您手机本地数据库中，用于直连 Readwise。",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.LightGray
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = textState,
                    onValueChange = { textState = it },
                    label = { Text("Readwise Token") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(textState) },
                enabled = textState.isNotBlank()
            ) {
                Text("保存")
            }
        },
        dismissButton = {
            if (token.isNotBlank()) {
                TextButton(onClick = onDismiss) {
                    Text("取消")
                }
            }
        }
    )
}
