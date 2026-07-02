package com.readerq.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
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
                    fontSize = 18.sp,
                    color = MaterialTheme.colorScheme.onBackground
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
                "all" to "全部"
            )
            val selectedTabIndex = tabs.indexOfFirst { it.first == currentView }.coerceAtLeast(0)
            
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
                    Tab(
                        selected = selectedTabIndex == index,
                        onClick = { viewModel.changeView(key) },
                        text = { 
                            Text(
                                label, 
                                fontSize = 12.sp, 
                                fontWeight = if (selectedTabIndex == index) FontWeight.Bold else FontWeight.Normal
                            ) 
                        }
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
                                viewModel.archiveDocument(doc.id)
                                true
                            }
                            DismissValue.DismissedToStart -> {
                                viewModel.deleteDocument(doc.id)
                                true
                            }
                            else -> false
                        }
                    }
                )

                SwipeToDismiss(
                    state = dismissState,
                    background = {
                        val direction = dismissState.dismissDirection ?: return@SwipeToDismiss
                        val color = when (direction) {
                            DismissDirection.StartToEnd -> Color(0xFF22C55E) // Green for Archive
                            DismissDirection.EndToStart -> Color(0xFFEF4444) // Red for Delete
                        }
                        val alignment = when (direction) {
                            DismissDirection.StartToEnd -> Alignment.CenterStart
                            DismissDirection.EndToStart -> Alignment.CenterEnd
                        }
                        val iconText = when (direction) {
                            DismissDirection.StartToEnd -> "归档"
                            DismissDirection.EndToStart -> "删除"
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
