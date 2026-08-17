package com.readerq.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.readerq.app.R
import com.readerq.app.data.DocumentEntity

/**
 * 右侧面板在双面板/大屏模式下未选中具体文档时呈现的封面瀑布流组件。
 * 数据完全同步左侧当前过滤出的文档列表。
 */
@Composable
fun RightCoverGridPane(
    documents: List<DocumentEntity>,
    theme: String,
    onDocumentClick: (DocumentEntity) -> Unit,
    modifier: Modifier = Modifier,
    isSidebarCollapsed: Boolean = false,
    onToggleSidebar: (() -> Unit)? = null
) {
    val cardBg = when (theme) {
        "light" -> Color(0xFFFFFFFF)
        "sepia" -> Color(0xFFEFECE6)
        else -> Color(0xFF1E1E1E)
    }

    val cardBorder = when (theme) {
        "light" -> Color(0xFFE5E7EB)
        "sepia" -> Color(0xFFE4DFD5)
        else -> Color(0xFF2D2D2D)
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (isSidebarCollapsed && onToggleSidebar != null) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)),
                tonalElevation = 6.dp,
                shadowElevation = 6.dp,
                modifier = Modifier
                    .padding(top = 16.dp, start = 20.dp)
                    .align(Alignment.TopStart)
                    .clickable { onToggleSidebar() }
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_sidebar_toggle),
                        contentDescription = "展开文档列表",
                        tint = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "展开列表",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
        if (documents.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_all),
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "暂无相关文章",
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        } else {
            BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                // 根据右侧面板实际宽度自适应计算 2~4 列
                val calculatedColumns = (maxWidth / 170.dp).toInt().coerceIn(2, 4)

                LazyVerticalStaggeredGrid(
                    columns = StaggeredGridCells.Fixed(calculatedColumns),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalItemSpacing = 12.dp
                ) {
                    items(documents, key = { it.id }) { doc ->
                        CoverGridCard(
                            doc = doc,
                            cardBg = cardBg,
                            cardBorder = cardBorder,
                            onClick = { onDocumentClick(doc) }
                        )
                    }
                }
            }
        }
    }
}

/**
 * 右侧瀑布流精简版封面卡片：突出展示大图封面/艺术海报 + 文章标题 + 分类与阅读时长
 */
@Composable
fun CoverGridCard(
    doc: DocumentEntity,
    cardBg: Color,
    cardBorder: Color,
    onClick: () -> Unit
) {
    val title = doc.title.ifBlank { "无标题文档" }
    val isInbox = doc.location.equals("new", ignoreCase = true)

    val categoryLabel = remember(doc) {
        when {
            doc.location.equals("feed", ignoreCase = true) || !doc.site_name.isNullOrBlank() -> doc.site_name ?: "RSS 订阅"
            doc.category.equals("book", ignoreCase = true) -> "书籍"
            doc.category.equals("pdf", ignoreCase = true) -> "PDF / 电子书"
            doc.category.equals("video", ignoreCase = true) -> "视频"
            doc.category.equals("email", ignoreCase = true) -> "邮件"
            doc.category.equals("tweet", ignoreCase = true) -> "推特"
            isInbox -> "收件箱"
            else -> "文章"
        }
    }

    val posterGradient = remember(doc.id) {
        val hash = (doc.id.hashCode() and 0x7FFFFFFF)
        val gradients = listOf(
            listOf(Color(0xFF2C3E50), Color(0xFF4CA1AF)),
            listOf(Color(0xFF654ea3), Color(0xFFeaafc8)),
            listOf(Color(0xFF16A085), Color(0xFFF4D03F)),
            listOf(Color(0xFF4568DC), Color(0xFFB06AB3)),
            listOf(Color(0xFF43C6AC), Color(0xFFF8FFAE)),
            listOf(Color(0xFF00B4DB), Color(0xFF0083B0)),
            listOf(Color(0xFF8E2DE2), Color(0xFF4A00E0)),
            listOf(Color(0xFFD31027), Color(0xFFEA384D))
        )
        gradients[hash % gradients.size]
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, cardBorder, RoundedCornerShape(14.dp))
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = cardBg),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            if (!doc.image_url.isNullOrBlank()) {
                // 拥有网络封面图片
                AsyncImage(
                    model = doc.image_url,
                    contentDescription = title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(130.dp)
                        .clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp))
                )
            } else {
                // 无封面图时，渲染色彩丰富的艺术渐变海报
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(110.dp)
                        .background(Brush.linearGradient(posterGradient))
                        .padding(12.dp),
                    contentAlignment = Alignment.BottomStart
                ) {
                    Text(
                        text = categoryLabel,
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // 卡片下半部分：标题与元数据
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(10.dp)
            ) {
                Text(
                    text = title,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 18.sp
                )

                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = categoryLabel,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )

                    val readingTimeText = doc.reading_time?.let { "$it 分钟阅读" } ?: "文章"
                    Text(
                        text = readingTimeText,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f)
                    )
                }
            }
        }
    }
}
