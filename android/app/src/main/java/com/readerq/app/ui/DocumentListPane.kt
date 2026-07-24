package com.readerq.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
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
import coil.compose.AsyncImage
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.ui.layout.ContentScale
import com.readerq.app.data.DocumentEntity
import com.readerq.app.R
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.graphics.luminance

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentListPane(
    viewModel: MainViewModel,
    isFeedTab: Boolean
) {
    val documents by viewModel.documents.collectAsState()
    val selectedDoc by viewModel.selectedDoc.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val currentView by viewModel.currentView.collectAsState()
    val theme by viewModel.theme.collectAsState()

    var showSearchBar by remember { mutableStateOf(false) }
    var showAddDialog by remember { mutableStateOf(false) }
    val searchQuery by viewModel.searchQuery.collectAsState()

    // 确保在 Feed 标签卡中，View 为 feed
    LaunchedEffect(isFeedTab) {
        if (isFeedTab) {
            viewModel.changeView("feed")
        } else if (currentView == "feed") {
            viewModel.changeView("new")
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Toolbar
        TopAppBar(
            title = {
                Text(
                    text = if (isFeedTab) "订阅" else "我的库",
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    color = MaterialTheme.colorScheme.onBackground,
                    maxLines = 1,
                    softWrap = false,
                    overflow = TextOverflow.Clip
                )
            },
            actions = {
                IconButton(onClick = { showSearchBar = !showSearchBar }) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = MaterialTheme.colorScheme.onBackground
                    )
                }
                IconButton(onClick = { showAddDialog = true }) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "添加文章",
                        tint = MaterialTheme.colorScheme.onBackground
                    )
                }
                IconButton(onClick = { viewModel.toggleTheme() }) {
                    Icon(
                        painter = painterResource(
                            id = when (theme) {
                                "light" -> R.drawable.ic_theme_light
                                "sepia" -> R.drawable.ic_theme_sepia
                                else -> R.drawable.ic_theme_dark
                            }
                        ),
                        contentDescription = "Toggle Theme",
                        tint = MaterialTheme.colorScheme.onBackground,
                        modifier = Modifier.size(20.dp)
                    )
                }
                IconButton(onClick = { viewModel.startSync() }, enabled = !isSyncing) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Sync",
                        tint = if (isSyncing) Color.Gray else MaterialTheme.colorScheme.onBackground
                    )
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.surface
            )
        )

        // Search input bar
        if (showSearchBar) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { viewModel.setSearchQuery(it) },
                    placeholder = { Text("搜索标题、作者或摘要...", color = Color.Gray, fontSize = 14.sp) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = MaterialTheme.colorScheme.onBackground,
                        unfocusedTextColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f),
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = if (theme == "sepia") Color(0xFFE4DFD5) else Color(0xFF2D2D2D)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        // Syncing indicator
        if (isSyncing) {
            LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary,
                trackColor = Color.Transparent
            )
        }

        // Secondary Tabs (Only for Library Tab)
        if (!isFeedTab) {
            val tabs = listOf(
                "new" to "收件箱",
                "later" to "稍后读",
                "archive" to "归档",
                "trash" to "垃圾箱",
                "all" to "全部"
            )
            val selectedTabIndex = tabs.indexOfFirst { it.first == currentView }.coerceAtLeast(0)
            
            BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                val isCompact = maxWidth < 250.dp
                
                TabRow(
                    selectedTabIndex = selectedTabIndex,
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = MaterialTheme.colorScheme.primary,
                    indicator = { tabPositions ->
                        TabRowDefaults.Indicator(
                            modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTabIndex]),
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                ) {
                    tabs.forEachIndexed { index, (key, label) ->
                        val iconRes = when (key) {
                            "new" -> R.drawable.ic_inbox
                            "later" -> R.drawable.ic_bookmark
                            "archive" -> R.drawable.ic_archive
                            "trash" -> R.drawable.ic_delete
                            else -> R.drawable.ic_all
                        }
                        
                        Tab(
                            selected = selectedTabIndex == index,
                            onClick = { viewModel.changeView(key) },
                            icon = if (isCompact) {
                                {
                                    Icon(
                                        painter = painterResource(id = iconRes),
                                        contentDescription = label,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            } else null,
                            text = if (!isCompact) {
                                {
                                    Text(
                                        label, 
                                        fontSize = 12.sp, 
                                        fontWeight = if (selectedTabIndex == index) FontWeight.Bold else FontWeight.Normal
                                    ) 
                                }
                            } else null
                        )
                    }
                }
            }
        }

        // Category / Tag active filter indicators
        val selectedCategory by viewModel.selectedCategory.collectAsState()
        val selectedTag by viewModel.selectedTag.collectAsState()

        if (selectedCategory != null || selectedTag != null) {
            val filterText = if (selectedCategory != null) {
                val displayName = when (selectedCategory) {
                    "article" -> "Articles"
                    "book" -> "Books"
                    "pdf" -> "PDFs"
                    "video" -> "Videos"
                    "email" -> "Emails"
                    "tweet" -> "Tweets"
                    else -> selectedCategory
                }
                "分类: $displayName"
            } else {
                "标签: #${selectedTag}"
            }

            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                shape = RoundedCornerShape(8.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(MaterialTheme.colorScheme.primary)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = filterText ?: "",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    Text(
                        text = "清除 ✕",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .clickable { viewModel.clearFilters() }
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
        }

        // List
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            items(documents, key = { it.id }) { doc ->
                val isSelected = selectedDoc?.id == doc.id
                
                val dismissState = rememberDismissState(
                    confirmValueChange = { dismissValue ->
                        when (dismissValue) {
                            DismissValue.DismissedToEnd -> {
                                if (currentView == "trash") {
                                    viewModel.restoreDocument(doc.id)
                                } else {
                                    viewModel.archiveDocument(doc.id)
                                }
                                true
                            }
                            DismissValue.DismissedToStart -> {
                                if (currentView == "trash") {
                                    viewModel.permanentlyDeleteDocument(doc.id)
                                } else {
                                    viewModel.deleteDocument(doc.id)
                                }
                                true
                            }
                            else -> false
                        }
                    }
                )

                // 关键修复：当 dismissState 停留在已完成滑动的状态时，立即重置为默认状态
                // 这可以防止归档/删除后绿色/红色背景持续显示遮挡文章标题
                LaunchedEffect(dismissState.currentValue) {
                    if (dismissState.currentValue != DismissValue.Default) {
                        dismissState.reset()
                    }
                }

                SwipeToDismiss(
                    state = dismissState,
                    background = {
                        val direction = dismissState.dismissDirection ?: return@SwipeToDismiss
                        val color = when (direction) {
                            DismissDirection.StartToEnd -> {
                                if (currentView == "trash") Color(0xFF3B82F6) else Color(0xFF22C55E)
                            }
                            DismissDirection.EndToStart -> Color(0xFFEF4444)
                        }
                        val alignment = when (direction) {
                            DismissDirection.StartToEnd -> Alignment.CenterStart
                            DismissDirection.EndToStart -> Alignment.CenterEnd
                        }
                        val iconText = when (direction) {
                            DismissDirection.StartToEnd -> if (currentView == "trash") "恢复" else "归档"
                            DismissDirection.EndToStart -> if (currentView == "trash") "彻底删除" else "删除"
                        }
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(color)
                                .padding(horizontal = 20.dp),
                            contentAlignment = alignment
                        ) {
                            Text(iconText, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    },
                    dismissContent = {
                        DocumentItemCard(
                            doc = doc,
                            isSelected = isSelected,
                            theme = theme,
                            onClick = { viewModel.selectDocument(doc) }
                        )
                    }
                )
            }
        }
    }

    // 添加文章对话框
    if (showAddDialog) {
        AddDocumentDialog(
            viewModel = viewModel,
            onDismiss = { showAddDialog = false }
        )
    }
}

@Composable
fun DocumentItemCard(
    doc: DocumentEntity,
    isSelected: Boolean,
    theme: String,
    onClick: () -> Unit
) {
    val isDark = theme == "dark"
    val isSepia = theme == "sepia"
    
    val bgColor = if (isSelected) {
        if (isDark) Color(0xFF252636) else if (isSepia) Color(0xFFE5DFD3) else Color(0xFFEEEEF5)
    } else {
        Color.Transparent
    }
    
    val textColor = MaterialTheme.colorScheme.onBackground
    val secondaryTextColor = if (isDark) Color.LightGray else if (isSepia) Color(0xFF5D544B) else Color.DarkGray
    val mutedColor = if (isDark) Color.Gray else if (isSepia) Color(0xFF8D8275) else Color.Gray
    val dividerColor = if (isDark) Color(0xFF262626) else if (isSepia) Color(0xFFE4DFD5) else Color(0xFFEEEEEE)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(bgColor)
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 12.dp)
            ) {
                // Category & Host
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = doc.category?.uppercase() ?: "ARTICLE",
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 9.sp
                    )
                    Text(
                        text = "•",
                        color = mutedColor,
                        fontSize = 9.sp
                    )
                    Text(
                        text = doc.site_name ?: "",
                        color = mutedColor,
                        fontSize = 9.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Title
                Text(
                    text = doc.title,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    color = textColor,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Author & Time / Progress
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (!doc.author.isNullOrBlank()) {
                        Text(
                            text = doc.author,
                            color = secondaryTextColor,
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false)
                        )
                        Text(
                            text = "•",
                            color = mutedColor,
                            fontSize = 11.sp
                        )
                    }
                    Text(
                        text = doc.reading_time ?: "1 min read",
                        color = mutedColor,
                        fontSize = 11.sp
                    )
                    if (doc.reading_progress > 0) {
                        Text(
                            text = "•",
                            color = mutedColor,
                            fontSize = 11.sp
                        )
                        Text(
                            text = "${(doc.reading_progress * 100).toInt()}% read",
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Image Thumbnail on the right
            if (!doc.image_url.isNullOrBlank()) {
                AsyncImage(
                    model = doc.image_url,
                    contentDescription = null,
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color.Gray.copy(alpha = 0.1f)),
                    contentScale = ContentScale.Crop
                )
            }
        }
        
        Divider(
            color = dividerColor,
            thickness = 1.dp,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddDocumentDialog(
    viewModel: MainViewModel,
    onDismiss: () -> Unit
) {
    val isSaving by viewModel.isSavingDoc.collectAsState()
    val saveResult by viewModel.saveDocResult.collectAsState()

    var activeTab by remember { mutableStateOf("url") } // "url" | "text"
    var urlInput by remember { mutableStateOf("") }
    var titleInput by remember { mutableStateOf("") }
    var textContent by remember { mutableStateOf("") }
    var authorInput by remember { mutableStateOf("") }
    var tagsInput by remember { mutableStateOf("") }

    val isDark = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardBg = if (isDark) Color(0xFF1E1E1E) else Color.White
    val inputBg = if (isDark) Color(0xFF2A2A2A) else Color(0xFFF5F5F5)
    val borderColor = if (isDark) Color(0xFF444444) else Color(0xFFE0E0E0)
    val accentColor = Color(0xFF3B82F6)

    // 处理保存结果
    LaunchedEffect(saveResult) {
        if (saveResult?.success == true) {
            kotlinx.coroutines.delay(1500)
            viewModel.clearSaveDocResult()
            onDismiss()
        }
    }

    Dialog(
        onDismissRequest = { if (!isSaving) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .wrapContentHeight(),
            shape = RoundedCornerShape(16.dp),
            color = cardBg,
            tonalElevation = 4.dp
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Title
                Text(
                    text = "添加文章",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = MaterialTheme.colorScheme.onBackground
                )

                // Tab row
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("url" to "URL", "text" to "文本").forEach { (key, label) ->
                        val isActive = activeTab == key
                        Surface(
                            onClick = { activeTab = key },
                            shape = RoundedCornerShape(8.dp),
                            color = if (isActive) accentColor else inputBg,
                            border = if (isActive) null else BorderStroke(1.dp, borderColor)
                        ) {
                            Text(
                                text = label,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                                fontSize = 13.sp,
                                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                                color = if (isActive) Color.White else MaterialTheme.colorScheme.onBackground
                            )
                        }
                    }
                }

                // Tab content
                when (activeTab) {
                    "url" -> {
                        OutlinedTextField(
                            value = urlInput,
                            onValueChange = { urlInput = it },
                            label = { Text("URL 地址") },
                            placeholder = { Text("https://example.com/article") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = accentColor,
                                unfocusedBorderColor = borderColor
                            )
                        )
                    }
                    "text" -> {
                        OutlinedTextField(
                            value = titleInput,
                            onValueChange = { titleInput = it },
                            label = { Text("标题") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = accentColor,
                                unfocusedBorderColor = borderColor
                            )
                        )
                        OutlinedTextField(
                            value = textContent,
                            onValueChange = { textContent = it },
                            label = { Text("内容") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 100.dp, max = 200.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = accentColor,
                                unfocusedBorderColor = borderColor
                            )
                        )
                    }
                }

                // Optional fields
                OutlinedTextField(
                    value = authorInput,
                    onValueChange = { authorInput = it },
                    label = { Text("作者 (可选)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = accentColor,
                        unfocusedBorderColor = borderColor
                    )
                )

                OutlinedTextField(
                    value = tagsInput,
                    onValueChange = { tagsInput = it },
                    label = { Text("标签 (可选，逗号分隔)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = accentColor,
                        unfocusedBorderColor = borderColor
                    )
                )

                // Result message
                saveResult?.let { result ->
                    Text(
                        text = result.message,
                        color = if (result.success) Color(0xFF22C55E) else Color(0xFFEF4444),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                // Action buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(
                        onClick = {
                            viewModel.clearSaveDocResult()
                            onDismiss()
                        },
                        enabled = !isSaving
                    ) {
                        Text("取消")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val tags = tagsInput.split(",")
                                .map { it.trim() }
                                .filter { it.isNotBlank() }
                                .takeIf { it.isNotEmpty() }

                            when (activeTab) {
                                "url" -> {
                                    if (urlInput.isNotBlank()) {
                                        viewModel.saveDocumentByUrl(
                                            url = urlInput.trim(),
                                            tags = tags,
                                            author = authorInput
                                        )
                                    }
                                }
                                "text" -> {
                                    if (titleInput.isNotBlank() && textContent.isNotBlank()) {
                                        val html = "<h1>${titleInput}</h1>\n${textContent.split("\n").joinToString("\n") { "<p>$it</p>" }}"
                                        viewModel.saveDocumentWithHtml(
                                            title = titleInput,
                                            html = html,
                                            tags = tags,
                                            author = authorInput
                                        )
                                    }
                                }
                            }
                        },
                        enabled = !isSaving && when (activeTab) {
                            "url" -> urlInput.isNotBlank()
                            "text" -> titleInput.isNotBlank() && textContent.isNotBlank()
                            else -> false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = accentColor)
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text(if (isSaving) "保存中..." else "保存")
                    }
                }
            }
        }
    }
}
