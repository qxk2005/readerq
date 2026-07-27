package com.readerq.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.readerq.app.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GlobalNotebookPane(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier
) {
    val theme by viewModel.theme.collectAsState()
    val categoryCounts by viewModel.categoryCounts.collectAsState()
    val allTags by viewModel.allTags.collectAsState()
    val documents by viewModel.documents.collectAsState()

    var tagSearchQuery by remember { mutableStateOf("") }

    val isDark = theme == "dark"
    val isSepia = theme == "sepia"
    val textColor = MaterialTheme.colorScheme.onBackground
    val mutedColor = if (isDark) Color.Gray else if (isSepia) Color(0xFF8D8275) else Color.Gray
    val dividerColor = if (isDark) Color(0xFF262626) else if (isSepia) Color(0xFFE4DFD5) else Color(0xFFEEEEEE)

    // 提炼所有 RSS 订阅源 site_name
    val rssSites = remember(documents) {
        documents
            .filter { it.location.equals("feed", ignoreCase = true) || !it.site_name.isNullOrBlank() }
            .mapNotNull { it.site_name }
            .distinct()
            .filter { it.isNotBlank() }
    }

    val categories = listOf(
        Triple("feed", "📡 RSS 订阅源", R.drawable.ic_tab_feed),
        Triple("article", "📄 文章", R.drawable.ic_cat_article),
        Triple("book", "📖 书籍", R.drawable.ic_cat_book),
        Triple("pdf", "📕 电子书 / PDF", R.drawable.ic_cat_pdf),
        Triple("video", "🎬 视频", R.drawable.ic_cat_video),
        Triple("email", "✉️ 邮件", R.drawable.ic_cat_email),
        Triple("tweet", "💬 推特 / 短文", R.drawable.ic_cat_tweet)
    )

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // --- 顶部 App Bar ---
        item {
            TopAppBar(
                title = {
                    Text("浏览与 RSS 订阅", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = textColor)
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }

        // --- RSS 订阅专区 Banner ---
        item {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .clickable {
                        viewModel.changeView("feed")
                    },
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.3f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_tab_feed),
                            contentDescription = "RSS 订阅",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "RSS 订阅流",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = "查看所有订阅源的更新文章与频段",
                                fontSize = 12.sp,
                                color = textColor.copy(alpha = 0.7f)
                            )
                        }
                    }
                    Text("进入 ❯", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                }
            }
        }

        // --- 已订阅 RSS 站点列表 (RSS Feeds Site List) ---
        if (rssSites.isNotEmpty()) {
            item {
                Text(
                    text = "已订阅 RSS 站点 (${rssSites.size})",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = textColor,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }

            items(rssSites) { site ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            viewModel.changeView("feed")
                        }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = Color(0xFFFF9500).copy(alpha = 0.15f)
                            ) {
                                Text(
                                    text = "RSS",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFFF9500),
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                            Text(
                                text = site,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                color = textColor
                            )
                        }
                        Text("❯", color = mutedColor, fontSize = 12.sp)
                    }
                    Divider(color = dividerColor, thickness = 1.dp)
                }
            }
        }

        // --- 分类类型 标题 ---
        item {
            Text(
                text = "内容类型分类",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = textColor,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)
            )
        }

        // --- 类型 分类列表 ---
        items(categories) { (catKey, label, iconRes) ->
            val count = if (catKey == "feed") {
                documents.count { it.location.equals("feed", ignoreCase = true) }
            } else {
                categoryCounts[catKey] ?: 0
            }
            
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        if (catKey == "feed") {
                            viewModel.changeView("feed")
                        } else {
                            viewModel.selectCategory(catKey)
                        }
                    }
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            painter = painterResource(id = iconRes),
                            contentDescription = label,
                            tint = textColor.copy(alpha = 0.75f),
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = label,
                            fontSize = 14.sp,
                            color = textColor,
                            fontWeight = FontWeight.Medium
                        )
                    }
                    
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (count > 0) {
                            Text(
                                text = count.toString(),
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(end = 8.dp)
                            )
                        }
                        Text("❯", color = mutedColor, fontSize = 12.sp)
                    }
                }
                Divider(color = dividerColor, thickness = 1.dp)
            }
        }

        // --- 标签 标题 ---
        item {
            Text(
                text = "标签分类",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = textColor,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp)
            )
        }

        // --- 搜索过滤框 ---
        item {
            OutlinedTextField(
                value = tagSearchQuery,
                onValueChange = { tagSearchQuery = it },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search", tint = mutedColor) },
                placeholder = { Text("搜索标签...", color = mutedColor, fontSize = 14.sp) },
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
        }

        // --- 标签列表 ---
        val filteredTags = allTags.filter { it.contains(tagSearchQuery, ignoreCase = true) }
        
        if (filteredTags.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("暂无标签记录", color = mutedColor, fontSize = 13.sp)
                }
            }
        } else {
            items(filteredTags) { tag ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            viewModel.selectTag(tag)
                        }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "# $tag",
                            fontSize = 14.sp,
                            color = textColor,
                            fontWeight = FontWeight.Medium
                        )
                        Text("❯", color = mutedColor, fontSize = 12.sp)
                    }
                    Divider(color = dividerColor, thickness = 1.dp)
                }
            }
        }

        // --- 底部留白 ---
        item {
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
