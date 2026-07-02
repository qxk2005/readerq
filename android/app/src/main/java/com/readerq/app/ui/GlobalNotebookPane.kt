package com.readerq.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
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
import com.readerq.app.data.DocumentEntity
import com.readerq.app.data.HighlightEntity
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GlobalNotebookPane(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier
) {
    val documentsWithHighlights by viewModel.documentsWithHighlights.collectAsState()
    val theme by viewModel.theme.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var selectedDocForHighlights by remember { mutableStateOf<DocumentEntity?>(null) }
    
    val isDark = theme == "dark"
    val isSepia = theme == "sepia"
    val textColor = MaterialTheme.colorScheme.onBackground
    val mutedColor = if (isDark) Color.Gray else if (isSepia) Color(0xFF8D8275) else Color.Gray
    val dividerColor = if (isDark) Color(0xFF262626) else if (isSepia) Color(0xFFE4DFD5) else Color(0xFFEEEEEE)

    val db = (androidx.compose.ui.platform.LocalContext.current.applicationContext as com.readerq.app.ReaderQApp).database
    val hlDao = remember { db.highlightDao() }
    val scope = rememberCoroutineScope()

    if (selectedDocForHighlights != null) {
        // --- 选中具体文档后的高亮列表（二级详细视图） ---
        val doc = selectedDocForHighlights!!
        var localHighlights by remember(doc.id) { mutableStateOf<List<HighlightEntity>>(emptyList()) }

        LaunchedEffect(doc.id) {
            hlDao.getHighlightsForDocument(doc.id).collect {
                localHighlights = it
            }
        }

        Column(
            modifier = modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            TopAppBar(
                title = {
                    Text(
                        text = doc.title,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = textColor,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                navigationIcon = {
                    IconButton(onClick = { selectedDocForHighlights = null }) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = textColor
                        )
                    }
                },
                actions = {
                    Button(
                        onClick = {
                            viewModel.selectDocument(doc)
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary
                        ),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Text("跳转阅读", fontSize = 12.sp)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (localHighlights.isEmpty()) {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().padding(top = 40.dp), contentAlignment = Alignment.Center) {
                            Text("当前文档无高亮记录", color = mutedColor, fontSize = 14.sp)
                        }
                    }
                }

                items(localHighlights) { hl ->
                    HighlightEditorCard(
                        hl = hl,
                        theme = theme,
                        onUpdate = { note, tags ->
                            viewModel.updateHighlight(hl.id, note, tags)
                        },
                        onDelete = {
                            viewModel.deleteHighlight(hl.id)
                        }
                    )
                }
            }
        }

    } else {
        // --- 主全局笔记本列表页 ---
        Column(
            modifier = modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            TopAppBar(
                title = {
                    Text("笔记本", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = textColor)
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )

            // 搜索过滤框
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search", tint = mutedColor) },
                placeholder = { Text("搜索高亮划线或批注...", color = mutedColor, fontSize = 14.sp) },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = textColor,
                    unfocusedTextColor = textColor.copy(alpha = 0.8f),
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = dividerColor
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            )

            if (searchQuery.isNotBlank()) {
                // --- 搜索模式：直接平铺搜索命中的高亮列表 ---
                val docMap = remember(documentsWithHighlights) { documentsWithHighlights.associateBy { it.id } }
                var searchResults by remember { mutableStateOf<List<Pair<HighlightEntity, DocumentEntity?>>>(emptyList()) }

                LaunchedEffect(searchQuery, docMap) {
                    scope.launch {
                        val allHlsList = mutableListOf<HighlightEntity>()
                        docMap.keys.forEach { docId ->
                            try {
                                val docHls = hlDao.getHighlightsForDocument(docId).first()
                                allHlsList.addAll(docHls)
                            } catch (e: Exception) {}
                        }
                        searchResults = allHlsList.filter { 
                            it.text.contains(searchQuery, ignoreCase = true) || 
                            (it.note?.contains(searchQuery, ignoreCase = true) ?: false)
                        }.map { hl -> 
                            hl to docMap[hl.document_id]
                        }
                    }
                }

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(horizontal = 16.dp)
                ) {
                    if (searchResults.isEmpty()) {
                        item {
                            Box(modifier = Modifier.fillMaxWidth().padding(top = 40.dp), contentAlignment = Alignment.Center) {
                                Text("没有找到匹配的高亮记录", color = mutedColor, fontSize = 14.sp)
                            }
                        }
                    }

                    items(searchResults) { (hl, doc) ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp)
                                .clickable {
                                    if (doc != null) {
                                        selectedDocForHighlights = doc
                                    }
                                }
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = doc?.title ?: "未知文档",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(text = hl.text, fontSize = 13.sp, color = textColor)
                                if (!hl.note.isNullOrBlank()) {
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(text = "✍️ 批注: ${hl.note}", fontSize = 12.sp, color = mutedColor, fontStyle = FontStyle.Italic)
                                }
                            }
                        }
                    }
                }

            } else {
                // --- 常规模式：展示有高亮的文章列表 ---
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    if (documentsWithHighlights.isEmpty()) {
                        item {
                            Box(modifier = Modifier.fillMaxSize().padding(top = 80.dp), contentAlignment = Alignment.Center) {
                                Text("暂无高亮记录，在阅读中划线保存高亮", color = mutedColor, fontSize = 14.sp)
                            }
                        }
                    }

                    items(documentsWithHighlights) { doc ->
                        var hlCount by remember(doc.id) { mutableStateOf(0) }
                        LaunchedEffect(doc.id) {
                            hlDao.getHighlightsForDocument(doc.id).collect {
                                hlCount = it.size
                            }
                        }

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedDocForHighlights = doc }
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = doc.title,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 15.sp,
                                        color = textColor,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(text = doc.author ?: "未知作者", color = mutedColor, fontSize = 11.sp)
                                        Text(text = " • ", color = mutedColor, fontSize = 11.sp)
                                        Text(text = "$hlCount 条高亮", color = MaterialTheme.colorScheme.primary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                                Text("❯", color = mutedColor, fontSize = 12.sp, modifier = Modifier.padding(start = 8.dp))
                            }
                            Divider(color = dividerColor, thickness = 1.dp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun HighlightEditorCard(
    hl: HighlightEntity,
    theme: String,
    onUpdate: (String, List<String>) -> Unit,
    onDelete: () -> Unit
) {
    val isDark = theme == "dark"
    val isSepia = theme == "sepia"
    val textColor = MaterialTheme.colorScheme.onBackground
    val mutedColor = if (isDark) Color.Gray else if (isSepia) Color(0xFF8D8275) else Color.Gray

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

    var isEditing by remember { mutableStateOf(false) }
    var editNoteText by remember { mutableStateOf(hl.note ?: "") }
    var editTagsText by remember { mutableStateOf(hlTags.joinToString(", ")) }

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
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
            // Highlight Quote Text
            Row(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .width(4.dp)
                        .height(36.dp)
                        .background(hlColor)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = hl.text,
                    color = textColor,
                    fontSize = 13.sp,
                    lineHeight = 18.sp
                )
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
                            onDelete()
                            isEditing = false
                        }
                    ) {
                        Text("删除高亮", color = Color(0xFFFCA5A5), fontSize = 13.sp)
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
                                onUpdate(editNoteText, tagsList)
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
                    Text(
                        text = "✍️ ${hl.note}",
                        color = textColor.copy(alpha = 0.8f),
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
                                    .background(if (isDark) Color(0xFF2D2D2D) else if (isSepia) Color(0xFFE4DFD5) else Color(0xFFEEEEEE))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(text = "#$tag", color = mutedColor, fontSize = 10.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
