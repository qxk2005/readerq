package com.readerq.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ArrowDropDown
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
    var showActionsMenu by remember { mutableStateOf(false) }
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
                // 1. 「功能 ▾」下拉小药丸
                Box(modifier = Modifier.padding(end = 2.dp)) {
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f)),
                        modifier = Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .clickable { showActionsMenu = true }
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)
                        ) {
                            Text(
                                text = "功能",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Icon(
                                imageVector = Icons.Default.ArrowDropDown,
                                contentDescription = "功能菜单",
                                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    DropdownMenu(
                        expanded = showActionsMenu,
                        onDismissRequest = { showActionsMenu = false }
                    ) {
                        DropdownMenuItem(
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Search,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                            },
                            text = { Text("搜索文章", fontSize = 13.sp) },
                            onClick = {
                                showSearchBar = !showSearchBar
                                showActionsMenu = false
                            }
                        )
                        DropdownMenuItem(
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Add,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                            },
                            text = { Text("添加文章", fontSize = 13.sp) },
                            onClick = {
                                showAddDialog = true
                                showActionsMenu = false
                            }
                        )
                        DropdownMenuItem(
                            leadingIcon = {
                                Icon(
                                    painter = painterResource(
                                        id = when (theme) {
                                            "light" -> R.drawable.ic_theme_light
                                            "sepia" -> R.drawable.ic_theme_sepia
                                            else -> R.drawable.ic_theme_dark
                                        }
                                    ),
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                            },
                            text = {
                                val themeName = when (theme) {
                                    "light" -> "浅色"
                                    "sepia" -> "羊皮纸"
                                    else -> "深色"
                                }
                                Text("切换主题 ($themeName)", fontSize = 13.sp)
                            },
                            onClick = {
                                viewModel.toggleTheme()
                                showActionsMenu = false
                            }
                        )
                        DropdownMenuItem(
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = null,
                                    tint = if (isSyncing) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.size(18.dp)
                                )
                            },
                            text = {
                                Text(
                                    if (isSyncing) "正在同步中..." else "立即同步数据",
                                    fontSize = 13.sp,
                                    color = if (isSyncing) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                                )
                            },
                            enabled = !isSyncing,
                            onClick = {
                                viewModel.startSync()
                                showActionsMenu = false
                            }
                        )
                    }
                }

                // 2. 「折叠列表」图标按钮
                IconButton(
                    onClick = { viewModel.toggleSidebarCollapsed() },
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_sidebar_toggle),
                        contentDescription = "收起文档列表",
                        tint = MaterialTheme.colorScheme.onBackground,
                        modifier = Modifier.size(20.dp)
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
                // 5 个分类 Tab（含“收件箱”、“稍后读”等 3 字标题），单行完整显示至少需要 340dp
                // 只要宽度不足 340dp，即判定为无法单行完整显示，自动切换为纯图标模式
                val showIconsOnly = maxWidth < 340.dp
                
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
                            icon = if (showIconsOnly) {
                                {
                                    Icon(
                                        painter = painterResource(id = iconRes),
                                        contentDescription = label,
                                        modifier = Modifier.size(19.dp)
                                    )
                                }
                            } else null,
                            text = if (!showIconsOnly) {
                                {
                                    Text(
                                        text = label, 
                                        fontSize = 12.sp, 
                                        fontWeight = if (selectedTabIndex == index) FontWeight.Bold else FontWeight.Normal,
                                        maxLines = 1,
                                        softWrap = false,
                                        overflow = TextOverflow.Ellipsis
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
                val displayName = when (selectedCategory?.lowercase()) {
                    "rss" -> "RSS 订阅"
                    "article" -> "文章"
                    "book" -> "书籍"
                    "pdf" -> "电子书 / PDF"
                    "video" -> "视频"
                    "email" -> "邮件"
                    "tweet" -> "推特 / 短文"
                    else -> selectedCategory
                }
                "分类: $displayName"
            } else {
                "标签: #${selectedTag}"
            }

            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                shape = RoundedCornerShape(8.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f, fill = false)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(5.dp)
                                .clip(RoundedCornerShape(2.5.dp))
                                .background(MaterialTheme.colorScheme.primary)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = filterText ?: "",
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Spacer(modifier = Modifier.width(6.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (selectedCategory?.lowercase()?.contains("rss") == true || selectedCategory == "RSS 订阅" || selectedCategory == "rss") {
                            Text(
                                text = "🤖 AI 推荐",
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f))
                                    .clickable { viewModel.selectDocument(null) }
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                        }
                        Text(
                            text = "清除 ✕",
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f),
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .clickable { viewModel.clearFilters() }
                                .padding(horizontal = 5.dp, vertical = 2.dp)
                        )
                    }
                }
            }
        }

        // 🗑️ 清空垃圾箱快捷操作栏
        var showEmptyTrashConfirmDialog by remember { mutableStateOf(false) }

        if (currentView == "trash" && documents.isNotEmpty()) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                shape = RoundedCornerShape(8.dp),
                color = Color(0xFFEF4444).copy(alpha = 0.12f),
                border = BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.3f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "垃圾箱中共 ${documents.size} 篇文章",
                        fontSize = 12.sp,
                        color = Color(0xFFEF4444),
                        fontWeight = FontWeight.Medium
                    )
                    Button(
                        onClick = { showEmptyTrashConfirmDialog = true },
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                        modifier = Modifier.height(28.dp),
                        shape = RoundedCornerShape(6.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                    ) {
                        Text("清空垃圾箱", fontSize = 11.sp, color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (showEmptyTrashConfirmDialog) {
            AlertDialog(
                onDismissRequest = { showEmptyTrashConfirmDialog = false },
                title = { Text("清空垃圾箱") },
                text = { Text("确定要清空垃圾箱中的所有文章吗？此操作将彻底删除所有文章并自动同步至 Readwise 云端。") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showEmptyTrashConfirmDialog = false
                            viewModel.emptyTrash()
                        }
                    ) {
                        Text("清空", color = Color(0xFFEF4444), fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showEmptyTrashConfirmDialog = false }) {
                        Text("取消")
                    }
                }
            )
        }

        var pendingConfirmAction by remember { mutableStateOf<PendingConfirmAction?>(null) }

        if (pendingConfirmAction != null) {
            val action = pendingConfirmAction!!
            AlertDialog(
                onDismissRequest = { pendingConfirmAction = null },
                title = { Text(action.title) },
                text = { Text(action.text) },
                confirmButton = {
                    TextButton(
                        onClick = {
                            val onConfirm = action.onConfirm
                            pendingConfirmAction = null
                            onConfirm()
                        }
                    ) {
                        Text(
                            action.confirmText,
                            color = if (action.isDanger) Color(0xFFEF4444) else MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                },
                dismissButton = {
                    TextButton(onClick = { pendingConfirmAction = null }) {
                        Text("取消")
                    }
                }
            )
        }

        val listState = rememberLazyListState()

        LaunchedEffect(selectedDoc?.id, documents) {
            val selectedId = selectedDoc?.id
            if (selectedId != null) {
                val index = documents.indexOfFirst { it.id == selectedId }
                if (index >= 0) {
                    listState.scrollToItem(index, 0)
                }
            }
        }

        // List
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            items(documents, key = { it.id }) { doc ->
                val isSelected = selectedDoc?.id == doc.id
                val isArchiveOrTrash = currentView == "trash" || currentView == "archive" || doc.location == "archive" || doc.location == "trash"
                
                val dismissState = rememberDismissState(
                    confirmValueChange = { dismissValue ->
                        when (dismissValue) {
                            DismissValue.DismissedToEnd -> {
                                if (isArchiveOrTrash) {
                                    pendingConfirmAction = PendingConfirmAction(
                                        title = "恢复文章",
                                        text = "确定要将《${doc.title.take(24)}》恢复至收件箱吗？",
                                        confirmText = "恢复",
                                        isDanger = false,
                                        onConfirm = { viewModel.restoreDocument(doc.id) }
                                    )
                                } else {
                                    pendingConfirmAction = PendingConfirmAction(
                                        title = "归档文章",
                                        text = "确定要归档《${doc.title.take(24)}》吗？归档后文章将移至归档区。",
                                        confirmText = "归档",
                                        isDanger = false,
                                        onConfirm = { viewModel.archiveDocument(doc.id) }
                                    )
                                }
                                false
                            }
                            DismissValue.DismissedToStart -> {
                                if (currentView == "trash") {
                                    pendingConfirmAction = PendingConfirmAction(
                                        title = "彻底删除文章",
                                        text = "确定要彻底删除《${doc.title.take(24)}》吗？此操作不可撤销！",
                                        confirmText = "彻底删除",
                                        isDanger = true,
                                        onConfirm = { viewModel.permanentlyDeleteDocument(doc.id) }
                                    )
                                } else {
                                    pendingConfirmAction = PendingConfirmAction(
                                        title = "移至废纸篓",
                                        text = "确定要将《${doc.title.take(24)}》移至废纸篓吗？",
                                        confirmText = "移至废纸篓",
                                        isDanger = true,
                                        onConfirm = { viewModel.deleteDocument(doc.id) }
                                    )
                                }
                                false
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
                                if (isArchiveOrTrash) Color(0xFF3B82F6) else Color(0xFF22C55E)
                            }
                            DismissDirection.EndToStart -> Color(0xFFEF4444)
                        }
                        val alignment = when (direction) {
                            DismissDirection.StartToEnd -> Alignment.CenterStart
                            DismissDirection.EndToStart -> Alignment.CenterEnd
                        }
                        val iconText = when (direction) {
                            DismissDirection.StartToEnd -> if (isArchiveOrTrash) "恢复" else "归档"
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
                            onClick = {
                                if (isSelected) {
                                    viewModel.selectDocument(null)
                                } else {
                                    viewModel.selectDocument(doc)
                                }
                            }
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
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.Gray.copy(alpha = 0.1f)),
                    contentScale = ContentScale.Crop
                )
            } else {
                CompactArtCoverThumbnail(doc = doc)
            }
        }
        
        Divider(
            color = dividerColor,
            thickness = 1.dp,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
fun CompactArtCoverThumbnail(
    doc: DocumentEntity,
    modifier: Modifier = Modifier
) {
    val hash = (doc.id.hashCode() and 0x7FFFFFFF)
    val gradients = listOf(
        listOf(Color(0xFF1A2A6C), Color(0xFFB21F1F), Color(0xFFFDBB2D)),
        listOf(Color(0xFF0F2027), Color(0xFF203A43), Color(0xFF2C5364)),
        listOf(Color(0xFF3A1C71), Color(0xFFD76D77), Color(0xFFFFAF7B)),
        listOf(Color(0xFF134E5E), Color(0xFF71B280)),
        listOf(Color(0xFF1D2671), Color(0xFFC33764)),
        listOf(Color(0xFF304352), Color(0xFF434343)),
        listOf(Color(0xFF00416A), Color(0xFFE4E5E6)),
        listOf(Color(0xFF2C3E50), Color(0xFF4CA1AF))
    )
    val colorList = gradients[hash % gradients.size]
    val initialLetter = doc.title.trim().take(1).uppercase().ifBlank { "R" }

    Box(
        modifier = modifier
            .size(56.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(androidx.compose.ui.graphics.Brush.linearGradient(colorList)),
        contentAlignment = Alignment.Center
    ) {
        androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
            drawCircle(
                color = Color.White.copy(alpha = 0.15f),
                radius = size.minDimension * 0.6f,
                center = androidx.compose.ui.geometry.Offset(size.width * 0.8f, size.height * 0.2f)
            )
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = initialLetter,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = Color.White
            )
            Text(
                text = (doc.category ?: "article").take(3).uppercase(),
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.8f)
            )
        }
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
    val pipelineProgress by viewModel.videoPipelineProgress.collectAsState()

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

    // 处理保存结果（视频文章等 pipeline 完成后再自动关闭）
    LaunchedEffect(saveResult) {
        if (saveResult?.success == true) {
            kotlinx.coroutines.delay(2000)
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
                    listOf("url" to "URL 链接", "video" to "🎥 视频", "text" to "文本").forEach { (key, label) ->
                        val isActive = activeTab == key
                        Surface(
                            onClick = { activeTab = key },
                            shape = RoundedCornerShape(8.dp),
                            color = if (isActive) accentColor else inputBg,
                            border = if (isActive) null else BorderStroke(1.dp, borderColor)
                        ) {
                            Text(
                                text = label,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                                fontSize = 12.sp,
                                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                                color = if (isActive) Color.White else MaterialTheme.colorScheme.onBackground
                            )
                        }
                    }
                }

                // Tab content
                when (activeTab) {
                    "url", "video" -> {
                        OutlinedTextField(
                            value = urlInput,
                            onValueChange = { urlInput = it },
                            label = { Text(if (activeTab == "video") "视频 URL (支持 YouTube 免 Cookie 字幕)" else "URL 地址") },
                            placeholder = { Text(if (activeTab == "video") "https://www.youtube.com/watch?v=..." else "https://example.com/article") },
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

                // 🎬 视频管线处理实时进度面板
                if (pipelineProgress != null) {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        color = if (isDark) Color(0xFF1A2332) else Color(0xFFEFF6FF),
                        border = BorderStroke(1.dp, accentColor.copy(alpha = 0.3f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            if (isSaving) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = accentColor,
                                    strokeWidth = 2.dp
                                )
                            }
                            Text(
                                text = pipelineProgress ?: "",
                                fontSize = 12.sp,
                                color = if (isDark) Color(0xFF93C5FD) else Color(0xFF1E40AF),
                                fontWeight = FontWeight.Medium,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }

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
                                "url", "video" -> {
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
                            "url", "video" -> urlInput.isNotBlank()
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
                        Text(
                            if (isSaving && pipelineProgress != null) "处理中..."
                            else if (isSaving) "保存中..."
                            else "保存"
                        )
                    }
                }
            }
        }
    }
}

data class PendingConfirmAction(
    val title: String,
    val text: String,
    val confirmText: String = "确认",
    val isDanger: Boolean = false,
    val onConfirm: () -> Unit
)
