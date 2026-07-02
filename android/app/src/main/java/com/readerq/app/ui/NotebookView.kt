package com.readerq.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.readerq.app.data.HighlightEntity
import kotlinx.serialization.json.Json
import com.readerq.app.R
import androidx.compose.ui.res.painterResource
import kotlinx.serialization.encodeToString
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale

@Composable
fun NotebookView(viewModel: MainViewModel) {
    val highlights by viewModel.highlights.collectAsState()
    val doc by viewModel.selectedDoc.collectAsState()
    val theme by viewModel.theme.collectAsState()

    var docNote by remember(doc) { mutableStateOf(doc?.notes ?: "") }
    var docTagsText by remember(doc) {
        val tagsMap = try {
            doc?.tags_json?.let { Json.decodeFromString<Map<String, Int>>(it) } ?: emptyMap()
        } catch (e: Exception) {
            emptyMap()
        }
        mutableStateOf(tagsMap.keys.joinToString(", "))
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Document Notes Editor Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("文档笔记", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = docNote,
                        onValueChange = { docNote = it },
                        placeholder = { Text("添加文档总结或备注...") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = MaterialTheme.colorScheme.onSurface,
                            unfocusedTextColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                        )
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = docTagsText,
                        onValueChange = { docTagsText = it },
                        placeholder = { Text("添加标签 (逗号分隔)...") },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("文档标签") },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = MaterialTheme.colorScheme.onSurface,
                            unfocusedTextColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                        )
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = {
                            val tagsList = docTagsText.split(",")
                                .map { it.trim() }
                                .filter { it.isNotEmpty() }
                            viewModel.updateDocumentMetadata(docNote, tagsList)
                        },
                        modifier = Modifier.align(Alignment.End)
                    ) {
                        Text("保存文档信息")
                    }
                }
            }
        }

        // Highlights list header
        item {
            Text(
                "高亮与批注 (${highlights.size})",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 15.sp
            )
        }

        // Highlights items using modular independent card views
        items(highlights, key = { it.id }) { hl ->
            NotebookHighlightCard(
                hl = hl,
                theme = theme,
                viewModel = viewModel
            )
        }
    }
}

@Composable
fun NotebookHighlightCard(
    hl: HighlightEntity,
    theme: String,
    viewModel: MainViewModel
) {
    val isDark = theme == "dark"
    val isSepia = theme == "sepia"
    
    val hlTags = remember(hl.tags_json) {
        try {
            if (hl.tags_json.isNullOrBlank()) {
                emptyList()
            } else {
                try {
                    Json.decodeFromString<List<String>>(hl.tags_json)
                } catch (e1: Exception) {
                    try {
                        val objList = Json.decodeFromString<List<com.readerq.app.api.ReadwiseExportTagItem>>(hl.tags_json)
                        objList.map { it.name }
                    } catch (e2: Exception) {
                        try {
                            val map = Json.decodeFromString<Map<String, Int>>(hl.tags_json)
                            map.keys.toList()
                        } catch (e3: Exception) {
                            emptyList()
                        }
                    }
                }
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    val hlColor = when (hl.color) {
        "yellow" -> Color(0xFFFDE047)
        "green" -> Color(0xFF86EFAC)
        "blue" -> Color(0xFF93C5FD)
        "purple" -> Color(0xFFC084FC)
        "red" -> Color(0xFFFCA5A5)
        else -> Color(0xFFFDE047)
    }

    val cardBg = when (theme) {
        "light" -> Color(0xFFF3F4F6)
        "sepia" -> Color(0xFFEFECE6)
        else -> Color(0xFF1E1E1E)
    }
    val mainTextColor = when (theme) {
        "light" -> Color(0xFF111827)
        "sepia" -> Color(0xFF2B251F)
        else -> Color(0xFFF3F4F6)
    }
    val subTextColor = when (theme) {
        "light" -> Color(0xFF4B5563)
        "sepia" -> Color(0xFF5C5246)
        else -> Color(0xFF9CA3AF)
    }
    val tagBg = when (theme) {
        "light" -> Color(0xFFE5E7EB)
        "sepia" -> Color(0xFFE4DFD5)
        else -> Color(0xFF2D2D2D)
    }

    var isEditing by remember { mutableStateOf(false) }
    var editNoteText by remember { mutableStateOf(hl.note ?: "") }
    var editTagsText by remember { mutableStateOf(hlTags.joinToString(", ")) }

    Card(
        colors = CardDefaults.cardColors(containerColor = cardBg),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = if (isEditing) 1.dp else 0.dp,
                color = if (isEditing) MaterialTheme.colorScheme.primary else Color.Transparent,
                shape = RoundedCornerShape(12.dp)
            )
            .clickable(enabled = !isEditing) {
                isEditing = true
                editNoteText = hl.note ?: ""
                editTagsText = hlTags.joinToString(", ")
            }
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Highlight Quote Text & Inline Images
            Row(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .width(4.dp)
                        .height(32.dp)
                        .background(hlColor)
                )
                Spacer(modifier = Modifier.width(8.dp))
                
                // Parse markdown image syntax: ![description](url)
                val imageRegex = Regex("""!\[[^]]*]\((https?://[^)]+)\)""")
                val matchResult = imageRegex.find(hl.text)
                val displayImageUrl = matchResult?.groups?.get(1)?.value
                val cleanText = if (displayImageUrl != null) {
                    hl.text.replace(imageRegex, "").trim()
                } else {
                    hl.text
                }

                Column(modifier = Modifier.weight(1f)) {
                    if (cleanText.isNotEmpty()) {
                        Text(
                            text = cleanText,
                            color = mainTextColor,
                            fontSize = 13.sp,
                            lineHeight = 18.sp
                        )
                        if (displayImageUrl != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                    
                    if (displayImageUrl != null) {
                        AsyncImage(
                            model = displayImageUrl,
                            contentDescription = "Highlight Image",
                            contentScale = ContentScale.Fit,
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 200.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .border(1.dp, tagBg, RoundedCornerShape(8.dp))
                        )
                    }
                }
            }

            if (isEditing) {
                Spacer(modifier = Modifier.height(12.dp))
                Divider(color = if (isDark) Color(0xFF333333) else Color(0xFFE5E7EB))
                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = editNoteText,
                    onValueChange = { editNoteText = it },
                    placeholder = { Text("添加高亮笔记...", fontSize = 13.sp) },
                    label = { Text("批注", fontSize = 11.sp) },
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = editTagsText,
                    onValueChange = { editTagsText = it },
                    placeholder = { Text("添加标签 (逗号分隔)...", fontSize = 13.sp) },
                    label = { Text("标签", fontSize = 11.sp) },
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(
                        onClick = {
                            viewModel.deleteHighlight(hl.id)
                            isEditing = false
                        }
                    ) {
                        Text("删除", color = Color(0xFFFCA5A5), fontSize = 13.sp)
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { isEditing = false }) {
                            Text("取消", color = Color.Gray, fontSize = 13.sp)
                        }
                        Button(
                            onClick = {
                                val tagsList = editTagsText.split(",")
                                    .map { it.trim() }
                                    .filter { it.isNotEmpty() }
                                viewModel.updateHighlight(hl.id, editNoteText, tagsList)
                                isEditing = false
                            },
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                        ) {
                            Text("保存", fontSize = 13.sp)
                        }
                    }
                }
            } else {
                // Render static note & tags
                if (!hl.note.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_edit_note),
                            contentDescription = "Note",
                            tint = subTextColor,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = hl.note,
                            color = subTextColor,
                            fontStyle = FontStyle.Italic,
                            fontSize = 12.sp
                        )
                    }
                }

                if (hlTags.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        hlTags.forEach { tag ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(tagBg)
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(text = "#$tag", color = subTextColor, fontSize = 10.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
