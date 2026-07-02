package com.readerq.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
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
    val cardBg = if (isDark) Color(0xFF1E1E1E) else if (isSepia) Color(0xFFEFECE6) else Color(0xFFF3F4F6)

    val categories = listOf(
        Triple("article", "📄 Articles (文章)", "article"),
        Triple("book", "📚 Books (书籍)", "book"),
        Triple("pdf", "📎 PDFs (电子书/PDF)", "pdf"),
        Triple("video", "🎥 Videos (视频)", "video"),
        Triple("email", "✉️ Emails (邮件)", "email"),
        Triple("tweet", "🐦 Tweets (推特/短文)", "tweet")
    )

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // --- 顶部栏 ---
        item {
            TopAppBar(
                title = {
                    Text("浏览", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = textColor)
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }

        // --- Types 标题 ---
        item {
            Text(
                text = "Types",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = textColor,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
            )
        }

        // --- Types 分类列表 ---
        items(categories) { (catKey, label, categoryName) ->
            val count = categoryCounts[catKey] ?: 0
            
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        viewModel.selectCategory(categoryName)
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
                        text = label,
                        fontSize = 14.sp,
                        color = textColor,
                        fontWeight = FontWeight.Medium
                    )
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

        // --- Tags 标题 ---
        item {
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Tags",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = textColor,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )
        }

        // --- Find Tag 搜索过滤框 ---
        item {
            OutlinedTextField(
                value = tagSearchQuery,
                onValueChange = { tagSearchQuery = it },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search", tint = mutedColor) },
                placeholder = { Text("Find tag...", color = mutedColor, fontSize = 14.sp) },
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

        // --- Tags 列表 ---
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
