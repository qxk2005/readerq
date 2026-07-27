package com.readerq.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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

    var tagSearchQuery by remember { mutableStateOf("") }

    val isDark = theme == "dark"
    val isSepia = theme == "sepia"
    val textColor = MaterialTheme.colorScheme.onBackground
    val mutedColor = if (isDark) Color.Gray else if (isSepia) Color(0xFF8D8275) else Color.Gray
    val dividerColor = if (isDark) Color(0xFF262626) else if (isSepia) Color(0xFFE4DFD5) else Color(0xFFEEEEEE)

    val categories = listOf(
        Triple("article", "文章", R.drawable.ic_cat_article),
        Triple("book", "书籍", R.drawable.ic_cat_book),
        Triple("pdf", "电子书 / PDF", R.drawable.ic_cat_pdf),
        Triple("video", "视频", R.drawable.ic_cat_video),
        Triple("email", "邮件", R.drawable.ic_cat_email),
        Triple("tweet", "推特 / 短文", R.drawable.ic_cat_tweet)
    )

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // --- 每日回顾 专属推荐 Banner ---
        item {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .clickable { viewModel.changeTab("review") },
                shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
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
                        Surface(
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
                            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f),
                            modifier = Modifier.size(38.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("✨", fontSize = 20.sp)
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("每日回顾 (Daily Review)", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = textColor)
                                Spacer(modifier = Modifier.width(6.dp))
                                Surface(
                                    shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
                                    color = Color(0xFFFF9500).copy(alpha = 0.2f)
                                ) {
                                    Text("Review", fontSize = 10.sp, color = Color(0xFFFF9500), fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp))
                                }
                            }
                            Text("基于 Readwise 间隔重复算法，重温灵感划线", fontSize = 12.sp, color = mutedColor)
                        }
                    }
                    Text("开始 ›", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                }
            }
        }

        // --- 内容类型分类 标题 ---
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
            val count = categoryCounts[catKey] ?: 0
            
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        viewModel.selectCategory(catKey)
                        viewModel.changeTab("library")
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
                            viewModel.changeTab("library")
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
