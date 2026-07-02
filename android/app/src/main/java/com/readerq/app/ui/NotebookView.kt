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
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive

@Composable
fun NotebookView(viewModel: MainViewModel) {
    val highlights by viewModel.highlights.collectAsState()
    val doc by viewModel.selectedDoc.collectAsState()

    var docNote by remember(doc) { mutableStateOf(doc?.notes ?: "") }
    // Parse tags from doc tags JSON
    var docTagsText by remember(doc) {
        val tagsMap = try {
            doc?.tags_json?.let { Json.decodeFromString<Map<String, Int>>(it) } ?: emptyMap()
        } catch (e: Exception) {
            emptyMap()
        }
        mutableStateOf(tagsMap.keys.joinToString(", "))
    }

    var editingHighlightId by remember { mutableStateOf<String?>(null) }
    var editNoteText by remember { mutableStateOf("") }
    var editTagsText by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Document Notes Editor Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1E1E)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("文档笔记", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = docNote,
                        onValueChange = { docNote = it },
                        placeholder = { Text("添加文档总结或备注...") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.LightGray
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
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.LightGray
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
                color = Color.White,
                fontSize = 15.sp
            )
        }

        // Highlights items
        items(highlights) { hl ->
            val isEditing = editingHighlightId == hl.id
            
            val hlTags = remember(hl.tags_json) {
                try {
                    hl.tags_json?.let { Json.decodeFromString<List<String>>(it) } ?: emptyList()
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

            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1E1E)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        width = if (isEditing) 1.dp else 0.dp,
                        color = if (isEditing) MaterialTheme.colorScheme.primary else Color.Transparent,
                        shape = RoundedCornerShape(12.dp)
                    )
                    .clickable(enabled = !isEditing) {
                        editingHighlightId = hl.id
                        editNoteText = hl.note ?: ""
                        editTagsText = hlTags.joinToString(", ")
                    }
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    // Highlight Quote Text
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Box(
                            modifier = Modifier
                                .width(4.dp)
                                .height(32.dp)
                                .background(hlColor)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = hl.text,
                            color = Color.White,
                            fontSize = 13.sp,
                            lineHeight = 18.sp
                        )
                    }

                    // Render inline editor if expanded
                    if (isEditing) {
                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = Color(0xFF2D2D2D))
                        Spacer(modifier = Modifier.height(12.dp))

                        // Note text field
                        OutlinedTextField(
                            value = editNoteText,
                            onValueChange = { editNoteText = it },
                            placeholder = { Text("添加高亮笔记...") },
                            label = { Text("批注") },
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        // Tags text field
                        OutlinedTextField(
                            value = editTagsText,
                            onValueChange = { editTagsText = it },
                            placeholder = { Text("添加标签 (逗号分隔)...") },
                            label = { Text("标签") },
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // Actions row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(
                                onClick = {
                                    viewModel.deleteHighlight(hl.id)
                                    editingHighlightId = null
                                }
                            ) {
                                Text("删除", color = Color(0xFFFCA5A5))
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                TextButton(onClick = { editingHighlightId = null }) {
                                    Text("取消", color = Color.Gray)
                                }
                                Button(
                                    onClick = {
                                        val tagsList = editTagsText.split(",")
                                            .map { it.trim() }
                                            .filter { it.isNotEmpty() }
                                        viewModel.updateHighlight(hl.id, editNoteText, tagsList)
                                        editingHighlightId = null
                                    }
                                ) {
                                    Text("保存")
                                }
                            }
                        }
                    } else {
                        // Render static info: note & tags
                        if (!hl.note.isNullOrBlank()) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "✍️ ${hl.note}",
                                color = Color.LightGray,
                                fontStyle = FontStyle.Italic,
                                fontSize = 12.sp
                            )
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
                                            .background(Color(0xFF2D2D2D))
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text(text = "#$tag", color = Color.Gray, fontSize = 10.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
