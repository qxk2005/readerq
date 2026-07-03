package com.readerq.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.text.style.TextOverflow
import com.readerq.app.ui.SyncProgress
import com.readerq.app.ui.SyncCounts
import com.readerq.app.ui.TestStage
import com.readerq.app.ui.TestResult
import com.readerq.app.ui.OssTestResult
import com.readerq.app.ui.GitHubRelease
import com.readerq.app.R
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.foundation.border
import androidx.compose.ui.draw.clip

@Composable
fun AdaptiveMainScreen(
    viewModel: MainViewModel,
    windowSizeClass: WindowSizeClass
) {
    val selectedDoc by viewModel.selectedDoc.collectAsState()
    val token by viewModel.token.collectAsState()
    val currentTab by viewModel.currentTab.collectAsState()
    var isNavBarCollapsed by rememberSaveable { mutableStateOf(false) }

    val theme by viewModel.theme.collectAsState()
    val detailPaneType by viewModel.detailPaneType.collectAsState()
    val isDetailPaneCollapsed by viewModel.isDetailPaneCollapsed.collectAsState()

    val tabIndicatorColor = when (theme) {
        "light" -> Color(0xFFE5E7EB)
        "sepia" -> Color(0xFFE4DFD5)
        else -> Color(0xFF2D2D2D)
    }
    val tabSelectedColor = when (theme) {
        "light" -> Color(0xFF1A1A1A)
        "sepia" -> Color(0xFF8B5E3C)
        else -> Color(0xFFFFFFFF)
    }
    val tabUnselectedColor = when (theme) {
        "light" -> Color(0xFF6B7280)
        "sepia" -> Color(0xFF8E887E)
        else -> Color(0xFF9CA3AF)
    }

    val colorScheme = when (theme) {
        "light" -> lightColorScheme(
            background = Color(0xFFFCFCFA),
            surface = Color(0xFFFFFFFF),
            primary = Color(0xFF1A1A1A),
            onBackground = Color(0xFF1A1A1A),
            onSurface = Color(0xFF2D2D2D)
        )
        "sepia" -> lightColorScheme(
            background = Color(0xFFF4F1EB),
            surface = Color(0xFFEFECE6),
            primary = Color(0xFF8B5E3C),
            onBackground = Color(0xFF2B251F),
            onSurface = Color(0xFF423A32),
            outline = Color(0xFFE4DFD5)
        )
        else -> darkColorScheme(
            background = Color(0xFF121212),
            surface = Color(0xFF1E1E1E),
            primary = Color(0xFFFFFFFF),
            onBackground = Color(0xFFE5E7EB),
            onSurface = Color(0xFFF3F4F6)
        )
    }

    MaterialTheme(colorScheme = colorScheme) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            val bottomBarContent = @Composable {
                if (isNavBarCollapsed) {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        color = MaterialTheme.colorScheme.surface,
                        tonalElevation = 0.dp
                    ) {
                        Column {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(0.5.dp)
                                    .background(tabIndicatorColor.copy(alpha = 0.5f))
                            )
                            Row(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(horizontal = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceAround
                            ) {
                                val tabs = listOf(
                                    Triple("library", "库", R.drawable.ic_tab_library),
                                    Triple("feed", "订阅", R.drawable.ic_tab_feed),
                                    Triple("notebook", "浏览", R.drawable.ic_tab_notebook),
                                    Triple("settings", "设置", R.drawable.ic_tab_settings)
                                )
                                
                                tabs.forEach { (tabId, label, icon) ->
                                    val isSelected = currentTab == tabId
                                    Row(
                                        modifier = Modifier
                                            .weight(1f)
                                            .fillMaxHeight()
                                            .padding(vertical = 6.dp, horizontal = 2.dp)
                                            .clip(RoundedCornerShape(16.dp))
                                            .background(if (isSelected) tabIndicatorColor else Color.Transparent)
                                            .clickable {
                                                if ((tabId == "library" || tabId == "feed") && selectedDoc != null && detailPaneType != null && !isDetailPaneCollapsed) {
                                                    viewModel.showSidebarAndCloseDetail()
                                                }
                                                viewModel.changeTab(tabId)
                                            }
                                            .padding(horizontal = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.Center
                                    ) {
                                        Icon(
                                            painter = painterResource(id = icon),
                                            contentDescription = label,
                                            modifier = Modifier.size(18.dp),
                                            tint = if (isSelected) tabSelectedColor else tabUnselectedColor
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = label,
                                            fontSize = 11.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                            color = if (isSelected) tabSelectedColor else tabUnselectedColor,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                                
                                Row(
                                    modifier = Modifier
                                        .weight(1f)
                                        .fillMaxHeight()
                                        .padding(vertical = 6.dp, horizontal = 2.dp)
                                        .clip(RoundedCornerShape(16.dp))
                                        .clickable { isNavBarCollapsed = false }
                                        .padding(horizontal = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.Center
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_tab_expand),
                                        contentDescription = "展开",
                                        modifier = Modifier.size(18.dp),
                                        tint = tabUnselectedColor
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "展开",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Normal,
                                        color = tabUnselectedColor,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                } else {
                    NavigationBar(
                        containerColor = MaterialTheme.colorScheme.surface,
                        tonalElevation = 0.dp
                    ) {
                        val tabs = listOf(
                            Triple("library", "库", R.drawable.ic_tab_library),
                            Triple("feed", "订阅", R.drawable.ic_tab_feed),
                            Triple("notebook", "浏览", R.drawable.ic_tab_notebook),
                            Triple("settings", "设置", R.drawable.ic_tab_settings)
                        )
                        tabs.forEach { (tabId, label, icon) ->
                            NavigationBarItem(
                                selected = currentTab == tabId,
                                onClick = {
                                    if ((tabId == "library" || tabId == "feed") && selectedDoc != null && detailPaneType != null && !isDetailPaneCollapsed) {
                                        viewModel.showSidebarAndCloseDetail()
                                    }
                                    viewModel.changeTab(tabId)
                                },
                                icon = {
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                    ) {
                                        Icon(
                                            painter = painterResource(id = icon),
                                            contentDescription = label,
                                            modifier = Modifier.size(20.dp)
                                        )
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = label, 
                                            fontSize = 10.sp, 
                                            fontWeight = if (currentTab == tabId) FontWeight.Bold else FontWeight.Normal
                                        )
                                    }
                                },
                                label = null,
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = tabSelectedColor,
                                    unselectedIconColor = tabUnselectedColor,
                                    indicatorColor = tabIndicatorColor
                                )
                            )
                        }
                        
                        NavigationBarItem(
                            selected = false,
                            onClick = { isNavBarCollapsed = true },
                            icon = {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_tab_collapse),
                                        contentDescription = "收窄",
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = "收窄", 
                                        fontSize = 10.sp, 
                                        fontWeight = FontWeight.Normal
                                    )
                                }
                            },
                            label = null,
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = tabSelectedColor,
                                unselectedIconColor = tabUnselectedColor,
                                indicatorColor = tabIndicatorColor
                            )
                        )
                    }
                }
            }

            val isCompact = windowSizeClass.widthSizeClass == WindowWidthSizeClass.Compact

            // Remember views
            val documentListPane = remember(viewModel) {
                movableContentOf { isFeedTab: Boolean ->
                    DocumentListPane(
                        viewModel = viewModel,
                        isFeedTab = isFeedTab
                    )
                }
            }

            val readingPane = remember(viewModel) {
                movableContentOf { modifier: Modifier, onBack: (() -> Unit)? ->
                    ReadingPane(
                        viewModel = viewModel,
                        modifier = modifier,
                        onBack = onBack
                    )
                }
            }

            if (isCompact) {
                // --- Single Pane layout (Phone) ---
                if (selectedDoc != null) {
                    BackHandler {
                        viewModel.selectDocument(null)
                    }
                    Row(Modifier.fillMaxSize()) {
                        readingPane(Modifier.fillMaxSize()) { viewModel.selectDocument(null) }
                    }
                } else {
                    Scaffold(
                        bottomBar = bottomBarContent
                    ) { paddingValues ->
                        Box(
                            modifier = Modifier
                                .padding(paddingValues)
                                .fillMaxSize()
                        ) {
                            when (currentTab) {
                                "library" -> documentListPane(false)
                                "feed" -> documentListPane(true)
                                "notebook" -> GlobalNotebookPane(viewModel = viewModel)
                                "settings" -> SettingsPane(viewModel = viewModel)
                            }
                        }
                    }
                }
            } else {
                // --- Dual Pane layout (Tablet/Foldable) ---
                Scaffold(
                    bottomBar = bottomBarContent
                ) { paddingValues ->
                    Row(
                        Modifier
                            .padding(paddingValues)
                            .fillMaxSize()
                    ) {
                        // Main Area
                        Box(modifier = Modifier.weight(1f)) {
                            if (currentTab == "settings") {
                                SettingsPane(viewModel = viewModel)
                            } else if (currentTab == "notebook") {
                                GlobalNotebookPane(viewModel = viewModel)
                            } else {
                                // Split layout for reading
                                val sidebarWidthDp by viewModel.sidebarWidthDp.collectAsState()
                                val isSidebarCollapsed by viewModel.isSidebarCollapsed.collectAsState()
                                val detailPaneWidthDp by viewModel.detailPaneWidthDp.collectAsState()
                                
                                BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                                    val maxWidthVal = maxWidth
                                    val density = LocalDensity.current.density
                                    
                                    // Calculate left sidebar width
                                    val maxAllowedSidebarWidth = maxWidthVal.value * 0.6f
                                    val isSidebarCollapsedActual = isSidebarCollapsed || (detailPaneType != null && !isDetailPaneCollapsed)
                                    val currentSidebarWidth = if (isSidebarCollapsedActual) {
                                        0.dp
                                    } else {
                                        sidebarWidthDp.coerceIn(200f, maxAllowedSidebarWidth).dp
                                    }

                                    // Calculate right detail pane width
                                    val maxAllowedDetailWidth = maxWidthVal.value * 0.6f
                                    val isDetailCollapsedActual = isDetailPaneCollapsed || detailPaneType == null
                                    val currentDetailWidth = if (isDetailCollapsedActual) {
                                        0.dp
                                    } else {
                                        detailPaneWidthDp.coerceIn(200f, maxAllowedDetailWidth).dp
                                    }

                                    Row(Modifier.fillMaxSize()) {
                                        if (isSidebarCollapsedActual) {
                                            // 侧栏折叠时，渲染一个最左侧的极窄边缘把手，以便用户重新展开侧栏
                                            Box(
                                                modifier = Modifier
                                                    .width(16.dp)
                                                    .fillMaxHeight()
                                                    .clickable { viewModel.toggleSidebarCollapsed() }
                                                    .background(Color.Transparent),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(width = 6.dp, height = 50.dp)
                                                        .clip(RoundedCornerShape(3.dp))
                                                        .background(if (theme == "sepia") Color(0xFF8E887E).copy(alpha = 0.5f) else Color.LightGray.copy(alpha = 0.5f))
                                                )
                                            }
                                        } else {
                                            Box(modifier = Modifier.width(currentSidebarWidth)) {
                                                documentListPane(currentTab == "feed")
                                            }
                                            
                                            // Left Draggable Split Divider
                                            Box(
                                                modifier = Modifier
                                                    .width(12.dp)
                                                    .fillMaxHeight()
                                                    .pointerInput(Unit) {
                                                        detectDragGestures { change, dragAmount ->
                                                            change.consume()
                                                            val newWidth = sidebarWidthDp + dragAmount.x / density
                                                            if (newWidth >= 200f && newWidth <= maxAllowedSidebarWidth) {
                                                                viewModel.updateSidebarWidth(newWidth)
                                                                if (isSidebarCollapsed) {
                                                                    viewModel.toggleSidebarCollapsed()
                                                                }
                                                            } else if (newWidth < 150f && !isSidebarCollapsed) {
                                                                viewModel.toggleSidebarCollapsed()
                                                            }
                                                        }
                                                    },
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Divider(
                                                    modifier = Modifier
                                                        .width(1.dp)
                                                        .fillMaxHeight(),
                                                    color = if (theme == "sepia") Color(0xFFE4DFD5) else Color(0xFF2D2D2D)
                                                )

                                                Box(
                                                    modifier = Modifier
                                                        .size(width = 16.dp, height = 50.dp)
                                                        .clip(RoundedCornerShape(8.dp))
                                                        .background(if (theme == "sepia") Color(0xFFEFECE6) else Color(0xFF1E1E1E))
                                                        .border(
                                                            width = 1.dp,
                                                            color = if (theme == "sepia") Color(0xFFE4DFD5) else Color(0xFF2D2D2D),
                                                            shape = RoundedCornerShape(8.dp)
                                                        )
                                                        .clickable {
                                                            viewModel.toggleSidebarCollapsed()
                                                        },
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Row(
                                                        horizontalArrangement = Arrangement.spacedBy(2.dp),
                                                        verticalAlignment = Alignment.CenterVertically
                                                    ) {
                                                        Box(
                                                            modifier = Modifier
                                                                .width(1.dp)
                                                                .height(12.dp)
                                                                .background(if (theme == "sepia") Color(0xFF8E887E) else Color.LightGray)
                                                        )
                                                        Box(
                                                            modifier = Modifier
                                                                .width(1.dp)
                                                                .height(12.dp)
                                                                .background(if (theme == "sepia") Color(0xFF8E887E) else Color.LightGray)
                                                        )
                                                    }
                                                }
                                            }
                                        }

                                        // Main Reading Area
                                        Box(modifier = Modifier.weight(1f)) {
                                            if (selectedDoc != null) {
                                                readingPane(Modifier.fillMaxSize(), null)
                                            } else {
                                                Box(
                                                    modifier = Modifier
                                                        .fillMaxSize()
                                                        .background(MaterialTheme.colorScheme.background),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Text(
                                                        text = "选择一篇文章开始阅读",
                                                        color = Color.Gray,
                                                        style = MaterialTheme.typography.bodyLarge
                                                    )
                                                }
                                            }
                                        }

                                        // Right Draggable Split Divider for Detail Pane
                                        if (currentDetailWidth > 0.dp) {
                                            Box(
                                                modifier = Modifier
                                                    .width(12.dp)
                                                    .fillMaxHeight()
                                                    .pointerInput(Unit) {
                                                        detectDragGestures { change, dragAmount ->
                                                            change.consume()
                                                            val newWidth = detailPaneWidthDp - dragAmount.x / density
                                                            if (newWidth >= 200f && newWidth <= maxAllowedDetailWidth) {
                                                                viewModel.updateDetailPaneWidth(newWidth)
                                                            } else if (newWidth < 150f) {
                                                                viewModel.closeDetailPane()
                                                            }
                                                        }
                                                    },
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Divider(
                                                    modifier = Modifier
                                                        .width(1.dp)
                                                        .fillMaxHeight(),
                                                    color = if (theme == "sepia") Color(0xFFE4DFD5) else Color(0xFF2D2D2D)
                                                )

                                                Box(
                                                    modifier = Modifier
                                                        .size(width = 16.dp, height = 50.dp)
                                                        .clip(RoundedCornerShape(8.dp))
                                                        .background(if (theme == "sepia") Color(0xFFEFECE6) else Color(0xFF1E1E1E))
                                                        .border(
                                                            width = 1.dp,
                                                            color = if (theme == "sepia") Color(0xFFE4DFD5) else Color(0xFF2D2D2D),
                                                            shape = RoundedCornerShape(8.dp)
                                                        )
                                                        .clickable {
                                                            viewModel.toggleDetailPaneCollapsed()
                                                        },
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Row(
                                                        horizontalArrangement = Arrangement.spacedBy(2.dp),
                                                        verticalAlignment = Alignment.CenterVertically
                                                    ) {
                                                        Box(
                                                            modifier = Modifier
                                                                .width(1.dp)
                                                                .height(12.dp)
                                                                .background(if (theme == "sepia") Color(0xFF8E887E) else Color.LightGray)
                                                        )
                                                        Box(
                                                            modifier = Modifier
                                                                .width(1.dp)
                                                                .height(12.dp)
                                                                .background(if (theme == "sepia") Color(0xFF8E887E) else Color.LightGray)
                                                        )
                                                    }
                                                }
                                            }
                                        }

                                        // Right Detail Pane
                                        if (currentDetailWidth > 0.dp) {
                                            Box(modifier = Modifier.width(currentDetailWidth)) {
                                                DetailPane(viewModel = viewModel)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Settings Sheet when token is null or blank
            if (token.isNullOrBlank()) {
                SettingsDialog(
                    viewModel = viewModel,
                    onDismiss = {}
                )
            }
        }
    }
}

@Composable
fun SettingsDialog(
    viewModel: MainViewModel,
    onDismiss: () -> Unit
) {
    val theme by viewModel.theme.collectAsState()
    val dialogBg = MaterialTheme.colorScheme.surface
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0x99000000))
            .clickable(enabled = true, onClick = {}),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .fillMaxHeight(0.85f)
                .padding(16.dp),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = dialogBg),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_tab_settings),
                            contentDescription = "Settings",
                            tint = MaterialTheme.colorScheme.onBackground,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = "首次使用请配置 API Token",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                    }
                }
                Divider(color = if (theme == "sepia") Color(0xFFE4DFD5) else Color(0xFF2D2D2D))
                SettingsPane(
                    viewModel = viewModel,
                    modifier = Modifier.weight(1f),
                    showSaveButton = true,
                    onSaveSuccess = onDismiss
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsPane(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier,
    showSaveButton: Boolean = true,
    onSaveSuccess: (() -> Unit)? = null
) {
    val token by viewModel.token.collectAsState()
    val openaiApiKey by viewModel.openaiApiKey.collectAsState()
    val openaiBaseUrl by viewModel.openaiBaseUrl.collectAsState()
    val openaiModel by viewModel.openaiModel.collectAsState()
    val openaiMaxTokens by viewModel.openaiMaxTokens.collectAsState()

    val ossRegion by viewModel.ossRegion.collectAsState()
    val ossBucket by viewModel.ossBucket.collectAsState()
    val ossAccessKeyId by viewModel.ossAccessKeyId.collectAsState()
    val ossAccessKeySecret by viewModel.ossAccessKeySecret.collectAsState()
    val ossCustomDomain by viewModel.ossCustomDomain.collectAsState()
    val ossPathPrefix by viewModel.ossPathPrefix.collectAsState()

    val theme by viewModel.theme.collectAsState()
    val fontSize by viewModel.fontSize.collectAsState()
    val fontFamily by viewModel.fontFamily.collectAsState()
    val lineHeight by viewModel.lineHeight.collectAsState()
    val contentWidth by viewModel.contentWidth.collectAsState()

    val syncCounts by viewModel.syncCounts.collectAsState()
    val syncStatus by viewModel.syncStatus.collectAsState()
    val syncProgress by viewModel.syncProgress.collectAsState()
    val syncError by viewModel.syncError.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()

    val testStages by viewModel.testStages.collectAsState()
    val testResult by viewModel.testResult.collectAsState()
    val testLoading by viewModel.testLoading.collectAsState()

    val ossTestResult by viewModel.ossTestResult.collectAsState()
    val ossTestLoading by viewModel.ossTestLoading.collectAsState()

    val githubReleases by viewModel.githubReleases.collectAsState()
    val changelogLoading by viewModel.changelogLoading.collectAsState()
    val changelogError by viewModel.changelogError.collectAsState()

    val isDark = theme == "dark"
    val dialogBg = MaterialTheme.colorScheme.surface
    val sidebarBg = if (theme == "dark") Color(0xFF151515) else if (theme == "sepia") Color(0xFFEFECE6) else Color(0xFFF3F4F6)
    val dividerColor = if (theme == "dark") Color(0xFF2D2D2D) else if (theme == "sepia") Color(0xFFE4DFD5) else Color(0xFFE5E7EB)
    val textColor = MaterialTheme.colorScheme.onBackground

    var activeTab by remember { mutableStateOf("api") }
    var showChangelog by remember { mutableStateOf(false) }

    // 本地表单状态
    var tokenInput by remember(token) { mutableStateOf(token ?: "") }
    var openaiApiKeyInput by remember(openaiApiKey) { mutableStateOf(openaiApiKey) }
    var openaiBaseUrlInput by remember(openaiBaseUrl) { mutableStateOf(openaiBaseUrl) }
    var openaiModelInput by remember(openaiModel) { mutableStateOf(openaiModel) }
    var openaiMaxTokensInput by remember(openaiMaxTokens) { mutableStateOf(openaiMaxTokens) }

    var ossRegionInput by remember(ossRegion) { mutableStateOf(ossRegion) }
    var ossBucketInput by remember(ossBucket) { mutableStateOf(ossBucket) }
    var ossAccessKeyIdInput by remember(ossAccessKeyId) { mutableStateOf(ossAccessKeyId) }
    var ossAccessKeySecretInput by remember(ossAccessKeySecret) { mutableStateOf(ossAccessKeySecret) }
    var ossCustomDomainInput by remember(ossCustomDomain) { mutableStateOf(ossCustomDomain) }
    var ossPathPrefixInput by remember(ossPathPrefix) { mutableStateOf(ossPathPrefix) }

    // 监听更新日志展开
    LaunchedEffect(showChangelog) {
        if (showChangelog) {
            viewModel.fetchGithubReleases()
        }
    }

    val configuration = androidx.compose.ui.platform.LocalConfiguration.current
    val screenWidth = configuration.screenWidthDp.dp
    val isMobile = screenWidth < 600.dp

    val sidebarWidth = if (isMobile) 95.dp else 140.dp
    val tabFontSize = if (isMobile) 11.sp else 13.sp
    val contentPadding = if (isMobile) 8.dp else 16.dp

    Column(modifier = modifier.fillMaxSize().background(dialogBg)) {
        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.Start
        ) {
            // Left Tab SideBar
            Column(
                modifier = Modifier
                    .width(sidebarWidth)
                    .fillMaxHeight()
                    .background(sidebarBg)
                    .padding(vertical = 8.dp)
            ) {
                val tabs = listOf(
                    Triple("api", "API 配置", R.drawable.ic_settings_api),
                    Triple("oss", "图床配置", R.drawable.ic_settings_oss),
                    Triple("appearance", "外观设置", R.drawable.ic_settings_appearance),
                    Triple("sync", "数据同步", R.drawable.ic_settings_sync),
                    Triple("shortcuts", "快捷键", R.drawable.ic_settings_shortcuts),
                    Triple("about", "关于", R.drawable.ic_settings_about)
                )
                tabs.forEach { (tabId, label, icon) ->
                    val isSelected = activeTab == tabId
                    TextButton(
                        onClick = { 
                            activeTab = tabId
                            if (tabId != "about") showChangelog = false
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 4.dp, vertical = 2.dp),
                        colors = ButtonDefaults.textButtonColors(
                            containerColor = if (isSelected) (if (isDark) Color(0xFF2E2E2E) else if (theme == "sepia") Color(0xFFE4DFD5) else Color(0xFFE5E7EB)) else Color.Transparent
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                painter = painterResource(id = icon),
                                contentDescription = label,
                                tint = if (isSelected) MaterialTheme.colorScheme.primary else textColor,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = label,
                                color = if (isSelected) MaterialTheme.colorScheme.primary else textColor,
                                fontSize = tabFontSize,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }

            Divider(modifier = Modifier.width(1.dp).fillMaxHeight(), color = dividerColor)

            // Right Content Panel
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .padding(contentPadding)
            ) {
                val scrollState = rememberScrollState()
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(scrollState),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    when (activeTab) {
                        "api" -> TabAPIContent(
                            token = tokenInput,
                            onTokenChange = { tokenInput = it },
                            apiKey = openaiApiKeyInput,
                            onApiKeyChange = { openaiApiKeyInput = it },
                            baseUrl = openaiBaseUrlInput,
                            onBaseUrlChange = { openaiBaseUrlInput = it },
                            model = openaiModelInput,
                            onModelChange = { openaiModelInput = it },
                            maxTokens = openaiMaxTokensInput,
                            onMaxTokensChange = { openaiMaxTokensInput = it },
                            testLoading = testLoading,
                            testStages = testStages,
                            testResult = testResult,
                            isDark = isDark,
                            onTestClick = {
                                viewModel.testConfig(
                                    openaiApiKeyInput,
                                    openaiBaseUrlInput,
                                    openaiModelInput,
                                    openaiMaxTokensInput
                                )
                            }
                        )
                        "oss" -> TabOSSContent(
                            region = ossRegionInput,
                            onRegionChange = { ossRegionInput = it },
                            bucket = ossBucketInput,
                            onBucketChange = { ossBucketInput = it },
                            accessKeyId = ossAccessKeyIdInput,
                            onAccessKeyIdChange = { ossAccessKeyIdInput = it },
                            accessKeySecret = ossAccessKeySecretInput,
                            onAccessKeySecretChange = { ossAccessKeySecretInput = it },
                            customDomain = ossCustomDomainInput,
                            onCustomDomainChange = { ossCustomDomainInput = it },
                            pathPrefix = ossPathPrefixInput,
                            onPathPrefixChange = { ossPathPrefixInput = it },
                            testLoading = ossTestLoading,
                            testResult = ossTestResult,
                            isDark = isDark,
                            onTestClick = {
                                viewModel.testOssConfig(
                                    ossRegionInput,
                                    ossBucketInput,
                                    ossAccessKeyIdInput,
                                    ossAccessKeySecretInput,
                                    ossCustomDomainInput,
                                    ossPathPrefixInput
                                )
                            }
                        )
                        "appearance" -> TabAppearanceContent(
                            theme = theme,
                            onThemeChange = { viewModel.toggleTheme() },
                            fontFamily = fontFamily,
                            onFontFamilyChange = {
                                viewModel.saveAppearanceSettings(it, fontSize, lineHeight, contentWidth)
                            },
                            fontSize = fontSize,
                            onFontSizeChange = {
                                viewModel.saveAppearanceSettings(fontFamily, it, lineHeight, contentWidth)
                            },
                            lineHeight = lineHeight,
                            onLineHeightChange = {
                                viewModel.saveAppearanceSettings(fontFamily, fontSize, it, contentWidth)
                            },
                            contentWidth = contentWidth,
                            onContentWidthChange = {
                                viewModel.saveAppearanceSettings(fontFamily, fontSize, lineHeight, it)
                            },
                            textColor = textColor
                        )
                        "sync" -> TabSyncContent(
                            syncCounts = syncCounts,
                            syncStatus = syncStatus,
                            syncProgress = syncProgress,
                            syncError = syncError,
                            isSyncing = isSyncing,
                            isDark = isDark,
                            onSyncClick = { fullSync ->
                                viewModel.startSync(fullSync)
                            },
                            onCancelClick = {
                                viewModel.cancelSync()
                            }
                        )
                        "shortcuts" -> TabShortcutsContent(textColor = textColor, dividerColor = dividerColor)
                        "about" -> TabAboutContent(
                            showChangelog = showChangelog,
                            onShowChangelogClick = { showChangelog = !showChangelog },
                            githubReleases = githubReleases,
                            changelogLoading = changelogLoading,
                            changelogError = changelogError,
                            textColor = textColor,
                            isDark = isDark
                        )
                    }
                }
            }
        }

        if (showSaveButton) {
            Divider(color = dividerColor, modifier = Modifier.fillMaxWidth())

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (activeTab == "sync" && tokenInput == "offline") {
                    TextButton(onClick = { tokenInput = "" }) {
                        Text("配置 Token", color = MaterialTheme.colorScheme.primary)
                    }
                } else if (activeTab == "api" && tokenInput.isBlank()) {
                    TextButton(onClick = {
                        tokenInput = "offline"
                        viewModel.saveToken("offline")
                    }) {
                        Text("使用本地离线模式", color = MaterialTheme.colorScheme.primary)
                    }
                }
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = {
                        viewModel.saveToken(tokenInput)
                        viewModel.saveOpenAiSettings(
                            openaiApiKeyInput,
                            openaiBaseUrlInput,
                            openaiModelInput,
                            openaiMaxTokensInput
                        )
                        viewModel.saveOssSettings(
                            ossRegionInput,
                            ossBucketInput,
                            ossAccessKeyIdInput,
                            ossAccessKeySecretInput,
                            ossCustomDomainInput,
                            ossPathPrefixInput
                        )
                        onSaveSuccess?.invoke()
                    },
                    enabled = tokenInput.isNotBlank() || activeTab != "api"
                ) {
                    Text("保存配置")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TabAPIContent(
    token: String,
    onTokenChange: (String) -> Unit,
    apiKey: String,
    onApiKeyChange: (String) -> Unit,
    baseUrl: String,
    onBaseUrlChange: (String) -> Unit,
    model: String,
    onModelChange: (String) -> Unit,
    maxTokens: Int,
    onMaxTokensChange: (Int) -> Unit,
    testLoading: Boolean,
    testStages: List<TestStage>?,
    testResult: TestResult?,
    isDark: Boolean,
    onTestClick: () -> Unit
) {
    val cardBg = if (isDark) Color(0xFF242424) else Color(0xFFF3F4F6)
    val labelColor = if (isDark) Color.LightGray else Color.DarkGray

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(
            colors = CardDefaults.cardColors(containerColor = cardBg),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "💡 在此处配置的值会保存到本地数据库并优先使用。如果你在此处留空，系统将自动回退使用环境变量配置。",
                style = MaterialTheme.typography.bodySmall,
                color = labelColor,
                modifier = Modifier.padding(12.dp)
            )
        }

        OutlinedTextField(
            value = token,
            onValueChange = onTokenChange,
            label = { Text("Readwise API Token") },
            placeholder = { Text("粘贴你的 Readwise Token...") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = apiKey,
            onValueChange = onApiKeyChange,
            label = { Text("OpenAI API Key") },
            placeholder = { Text("sk-...") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = baseUrl,
            onValueChange = onBaseUrlChange,
            label = { Text("OpenAI 兼容服务器地址") },
            placeholder = { Text("https://api.openai.com/v1") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = model,
            onValueChange = onModelChange,
            label = { Text("AI 模型名称") },
            placeholder = { Text("gpt-4o-mini") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = if (maxTokens == 0) "" else maxTokens.toString(),
            onValueChange = { onMaxTokensChange(it.toIntOrNull() ?: 4096) },
            label = { Text("最大回答 Token 限制 (max_tokens)") },
            placeholder = { Text("4096") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Button(
            onClick = onTestClick,
            enabled = !testLoading && apiKey.isNotBlank() && token.isNotBlank(),
            modifier = Modifier.padding(top = 4.dp)
        ) {
            if (testLoading) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                Spacer(modifier = Modifier.width(8.dp))
                Text("测试中...")
            } else {
                Text("⚡ 测试连接")
            }
        }

        // Test Stages and Diagnostics
        if (testStages != null || testResult != null) {
            Card(
                colors = CardDefaults.cardColors(containerColor = cardBg),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("🔌 连接测试诊断详情", fontWeight = FontWeight.Bold, color = if (isDark) Color.White else Color.Black)
                    
                    testStages?.forEach { stage ->
                        val icon = when (stage.status) {
                            "success" -> "✅"
                            "failed" -> "❌"
                            "running" -> "⏳"
                            else -> "⚪"
                        }
                        val statusText = when (stage.status) {
                            "success" -> "已完成"
                            "failed" -> "失败"
                            "running" -> "进行中..."
                            else -> "等待开始..."
                        }
                        val stageColor = if (stage.status == "failed") Color.Red else (if (stage.status == "success") Color(0xFF22C55E) else labelColor)
                        Column {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("$icon ${stage.name}", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = if (isDark) Color.White else Color.Black)
                                Text(statusText, color = stageColor, fontSize = 12.sp)
                            }
                            Text(stage.message, fontSize = 11.sp, color = labelColor, modifier = Modifier.padding(start = 24.dp))
                        }
                    }

                    testResult?.let { res ->
                        Divider(color = if (isDark) Color(0xFF333333) else Color(0xFFE5E7EB), modifier = Modifier.padding(vertical = 4.dp))
                        if (res.success) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0x1A22C55E))
                                    .padding(8.dp)
                            ) {
                                Text("🎉 测试连接成功！(总耗时: ${res.duration}ms)", color = Color(0xFF22C55E), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                res.reply?.let { reply ->
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text("AI 响应内容: \"$reply\"", fontSize = 12.sp, color = if (isDark) Color.White else Color.Black)
                                }
                            }
                        } else {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0x1AEF4444))
                                    .padding(8.dp)
                            ) {
                                Text("❌ 测试连接失败", color = Color.Red, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                res.error?.let { err ->
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(err, fontSize = 12.sp, color = if (isDark) Color.White else Color.Black)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TabOSSContent(
    region: String,
    onRegionChange: (String) -> Unit,
    bucket: String,
    onBucketChange: (String) -> Unit,
    accessKeyId: String,
    onAccessKeyIdChange: (String) -> Unit,
    accessKeySecret: String,
    onAccessKeySecretChange: (String) -> Unit,
    customDomain: String,
    onCustomDomainChange: (String) -> Unit,
    pathPrefix: String,
    onPathPrefixChange: (String) -> Unit,
    testLoading: Boolean,
    testResult: OssTestResult?,
    isDark: Boolean,
    onTestClick: () -> Unit
) {
    val cardBg = if (isDark) Color(0xFF242424) else Color(0xFFF3F4F6)
    val labelColor = if (isDark) Color.LightGray else Color.DarkGray

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(
            colors = CardDefaults.cardColors(containerColor = cardBg),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "💡 配置阿里云 OSS 后，高亮包含图片的内容时将自动上传图片到图床，并以 Markdown 格式发送到 Readwise。Bucket 需开启公共读权限。",
                style = MaterialTheme.typography.bodySmall,
                color = labelColor,
                modifier = Modifier.padding(12.dp)
            )
        }

        OutlinedTextField(
            value = region,
            onValueChange = onRegionChange,
            label = { Text("OSS Region (地域)") },
            placeholder = { Text("oss-cn-hangzhou") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = bucket,
            onValueChange = onBucketChange,
            label = { Text("Bucket 名称") },
            placeholder = { Text("my-image-bucket") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = accessKeyId,
            onValueChange = onAccessKeyIdChange,
            label = { Text("AccessKey ID") },
            placeholder = { Text("LTAI5t...") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = accessKeySecret,
            onValueChange = onAccessKeySecretChange,
            label = { Text("AccessKey Secret") },
            placeholder = { Text("输入你的 AccessKey Secret...") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = customDomain,
            onValueChange = onCustomDomainChange,
            label = { Text("自定义域名 (可选)") },
            placeholder = { Text("https://img.example.com") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = pathPrefix,
            onValueChange = onPathPrefixChange,
            label = { Text("存储路径前缀") },
            placeholder = { Text("readerq") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Button(
            onClick = onTestClick,
            enabled = !testLoading && region.isNotBlank() && bucket.isNotBlank() && accessKeyId.isNotBlank() && accessKeySecret.isNotBlank(),
            modifier = Modifier.padding(top = 4.dp)
        ) {
            if (testLoading) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                Spacer(modifier = Modifier.width(8.dp))
                Text("测试中...")
            } else {
                Text("☁️ 测试 OSS 连接")
            }
        }

        testResult?.let { res ->
            Card(
                colors = CardDefaults.cardColors(containerColor = cardBg),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    if (res.success) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0x1A22C55E))
                                .padding(8.dp)
                        ) {
                            Text("🎉 OSS 连接测试成功！", color = Color(0xFF22C55E), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            res.ossUrl?.let { url ->
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("测试图片 URL: $url", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    } else {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0x1AEF4444))
                                .padding(8.dp)
                        ) {
                            Text("❌ OSS 连接测试失败", color = Color.Red, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            res.error?.let { err ->
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(err, fontSize = 12.sp, color = if (isDark) Color.White else Color.Black)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TabAppearanceContent(
    theme: String,
    onThemeChange: (String) -> Unit,
    fontFamily: String,
    onFontFamilyChange: (String) -> Unit,
    fontSize: Int,
    onFontSizeChange: (Int) -> Unit,
    lineHeight: Float,
    onLineHeightChange: (Float) -> Unit,
    contentWidth: Int,
    onContentWidthChange: (Int) -> Unit,
    textColor: Color
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // 主题
        Column {
            Text("主题", color = textColor, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = { if (theme != "light") onThemeChange("light") },
                    border = BorderStroke(
                        width = 1.dp,
                        color = if (theme == "light") MaterialTheme.colorScheme.primary else Color.Gray
                    ),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (theme == "light") MaterialTheme.colorScheme.primary.copy(alpha = 0.1f) else Color.Transparent
                    )
                ) {
                    Text("☀️ 浅色", color = if (theme == "light") MaterialTheme.colorScheme.primary else textColor)
                }
                OutlinedButton(
                    onClick = { if (theme != "dark") onThemeChange("dark") },
                    border = BorderStroke(
                        width = 1.dp,
                        color = if (theme == "dark") MaterialTheme.colorScheme.primary else Color.Gray
                    ),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (theme == "dark") MaterialTheme.colorScheme.primary.copy(alpha = 0.1f) else Color.Transparent
                    )
                ) {
                    Text("🌙 深色", color = if (theme == "dark") MaterialTheme.colorScheme.primary else textColor)
                }
            }
        }

        // 字体
        Column {
            Text("阅读字体", color = textColor, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = { onFontFamilyChange("serif") },
                    border = BorderStroke(
                        width = 1.dp,
                        color = if (fontFamily == "serif") MaterialTheme.colorScheme.primary else Color.Gray
                    ),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (fontFamily == "serif") MaterialTheme.colorScheme.primary.copy(alpha = 0.1f) else Color.Transparent
                    )
                ) {
                    Text("衬线体", color = if (fontFamily == "serif") MaterialTheme.colorScheme.primary else textColor)
                }
                OutlinedButton(
                    onClick = { onFontFamilyChange("sans") },
                    border = BorderStroke(
                        width = 1.dp,
                        color = if (fontFamily == "sans") MaterialTheme.colorScheme.primary else Color.Gray
                    ),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (fontFamily == "sans") MaterialTheme.colorScheme.primary.copy(alpha = 0.1f) else Color.Transparent
                    )
                ) {
                    Text("无衬线", color = if (fontFamily == "sans") MaterialTheme.colorScheme.primary else textColor)
                }
            }
        }

        // 字号
        Column {
            Text("字号: ${fontSize}px", color = textColor, fontSize = 13.sp)
            Slider(
                value = fontSize.toFloat(),
                onValueChange = { onFontSizeChange(it.toInt()) },
                valueRange = 14f..24f,
                steps = 9
            )
        }

        // 行高
        Column {
            Text("行高: ${String.format("%.1f", lineHeight)}", color = textColor, fontSize = 13.sp)
            Slider(
                value = lineHeight,
                onValueChange = { onLineHeightChange(it) },
                valueRange = 1.4f..2.4f,
                steps = 9
            )
        }

        // 内容宽度
        Column {
            Text("内容宽度: ${contentWidth}px", color = textColor, fontSize = 13.sp)
            Slider(
                value = contentWidth.toFloat(),
                onValueChange = { onContentWidthChange(it.toInt()) },
                valueRange = 500f..1000f,
                steps = 24
            )
        }
    }
}

@Composable
fun TabSyncContent(
    syncCounts: SyncCounts,
    syncStatus: String,
    syncProgress: SyncProgress?,
    syncError: String?,
    isSyncing: Boolean,
    isDark: Boolean,
    onSyncClick: (Boolean) -> Unit,
    onCancelClick: () -> Unit
) {
    val cardBg = if (isDark) Color(0xFF242424) else Color(0xFFF3F4F6)
    val labelColor = if (isDark) Color.LightGray else Color.DarkGray

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Card(
            colors = CardDefaults.cardColors(containerColor = cardBg),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("上次同步", color = labelColor, fontSize = 13.sp)
                    val timeStr = syncCounts.lastSync ?: "从未同步"
                    Text(timeStr, color = if (isDark) Color.White else Color.Black, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("本地文档总数", color = labelColor, fontSize = 13.sp)
                    Text("${syncCounts.local} 篇", color = if (isDark) Color.White else Color.Black, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("云端记录总数", color = labelColor, fontSize = 13.sp)
                    val remoteStr = if (syncCounts.remote > 0) "${syncCounts.remote} 篇" else "未知"
                    Text(remoteStr, color = if (isDark) Color.White else Color.Black, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("当前状态", color = labelColor, fontSize = 13.sp)
                    val statusText = when (syncStatus) {
                        "syncing" -> "同步中..."
                        "canceling" -> "正在取消..."
                        "error" -> "同步失败"
                        "canceled" -> "已取消"
                        else -> "空闲"
                    }
                    val statusColor = when (syncStatus) {
                        "syncing" -> MaterialTheme.colorScheme.primary
                        "error" -> Color.Red
                        "canceled" -> Color.Gray
                        else -> if (isDark) Color.White else Color.Black
                    }
                    Text(statusText, color = statusColor, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }

                // 进度条渲染
                if (isSyncing && syncProgress != null) {
                    Spacer(modifier = Modifier.height(4.dp))
                    val phaseText = when (syncProgress.phase) {
                        "documents" -> "拉取文档中（增量）..."
                        "highlights" -> "拉取高亮中（增量）..."
                        "tags" -> "拉取标签中..."
                        "done" -> "处理完成"
                        else -> "准备中..."
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(phaseText, fontSize = 11.sp, color = labelColor)
                        val totalStr = if (syncProgress.total > 0) syncProgress.total.toString() else "--"
                        Text("${syncProgress.fetched} / $totalStr", fontSize = 11.sp, color = labelColor)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    if (syncProgress.total > 0) {
                        LinearProgressIndicator(
                            progress = syncProgress.fetched.toFloat() / syncProgress.total.toFloat(),
                            modifier = Modifier.fillMaxWidth(),
                            color = MaterialTheme.colorScheme.primary
                        )
                    } else {
                        LinearProgressIndicator(
                            modifier = Modifier.fillMaxWidth(),
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }

        if (syncError != null) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0x1AEF4444)),
                border = BorderStroke(1.dp, Color.Red.copy(alpha = 0.5f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "⚠️ 同步出错: $syncError",
                    color = Color.Red,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(12.dp)
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (!isSyncing) {
                Button(
                    onClick = { onSyncClick(false) },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("🔄 增量同步更新")
                }
                OutlinedButton(
                    onClick = { onSyncClick(true) },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("完整重新同步")
                }
            } else {
                Button(
                    onClick = onCancelClick,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Red),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("🛑 取消同步", color = Color.White)
                }
            }
        }
    }
}

@Composable
fun TabShortcutsContent(textColor: Color, dividerColor: Color) {
    val shortcuts = listOf(
        "Space / Enter" to "展开/收起阅读器",
        "J / K" to "上一个 / 下一个文档",
        "I / O" to "选中文档移入 收件箱 / 归档",
        "L" to "标记为 稍后读",
        "D / Delete" to "删除当前文章",
        "/" to "激活搜索栏",
        "Tab" to "切换分类视图",
        "G" to "呼出 AI 助手 (GhostReader)"
    )

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("⌨️ 快捷指令指南", fontWeight = FontWeight.Bold, color = textColor, fontSize = 15.sp)
        Text("虽然本移动客户端主要以触控手势为主，但在平板外接键盘或桌面环境中，以下快捷键仍然有效：", color = Color.Gray, fontSize = 12.sp)
        Spacer(modifier = Modifier.height(6.dp))

        shortcuts.forEach { (key, desc) ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = key,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp
                )
                Text(
                    text = desc,
                    color = textColor,
                    fontSize = 13.sp
                )
            }
            Divider(color = dividerColor)
        }
    }
}

@Composable
fun TabAboutContent(
    showChangelog: Boolean,
    onShowChangelogClick: () -> Unit,
    githubReleases: List<GitHubRelease>,
    changelogLoading: Boolean,
    changelogError: String?,
    textColor: Color,
    isDark: Boolean
) {
    val cardBg = if (isDark) Color(0xFF242424) else Color(0xFFF3F4F6)
    val labelColor = if (isDark) Color.LightGray else Color.DarkGray

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (!showChangelog) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "🐙 ReaderQ",
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 24.sp,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "移动客户端版本: v1.0.0",
                    color = labelColor,
                    fontSize = 13.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "ReaderQ 是一款致力于打造最纯粹、最高效的 Readwise 离线高亮与多端阅读辅助工具。本 Android 版本依据 macOS 版本实现机制 1:1 精确复刻。",
                    color = textColor,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
            }

            Button(
                onClick = onShowChangelogClick,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("🗒️ 查看更新日志 (GitHub Releases)")
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("🗒️ 发布历史与日志", fontWeight = FontWeight.Bold, color = textColor, fontSize = 15.sp)
                TextButton(onClick = onShowChangelogClick) {
                    Text("返回关于", color = MaterialTheme.colorScheme.primary)
                }
            }

            if (changelogLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else if (changelogError != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0x1AEF4444)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = changelogError,
                        color = Color.Red,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            } else {
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    githubReleases.take(15).forEach { release ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = cardBg),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = release.name.ifBlank { release.tag_name },
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = if (isDark) Color.White else Color.Black
                                )
                                Text(
                                    text = release.published_at?.take(10) ?: "",
                                    fontSize = 11.sp,
                                    color = labelColor,
                                    modifier = Modifier.padding(vertical = 2.dp)
                                )
                                Divider(
                                    color = if (isDark) Color(0xFF333333) else Color(0xFFE5E7EB),
                                    modifier = Modifier.padding(vertical = 4.dp)
                                )
                                Text(
                                    text = release.body ?: "无发布说明",
                                    fontSize = 12.sp,
                                    color = textColor,
                                    lineHeight = 16.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
