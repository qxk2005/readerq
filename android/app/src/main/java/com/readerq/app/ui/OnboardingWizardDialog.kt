package com.readerq.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.readerq.app.R

/**
 * Android 原生 5 步精美初始化配置向导 (Onboarding Wizard)
 * 支持 Readwise、OpenAI API / DeepSeek、阿里云 OSS 的获取教程、实时测试与回填保存
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingWizardDialog(
    viewModel: MainViewModel,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    var step by remember { mutableStateOf(1) } // 1: Welcome, 2: Readwise, 3: AI, 4: OSS, 5: Finish

    // 观察 ViewModel 中已存有的配置参数 (自动回显)
    val existingToken by viewModel.token.collectAsState()
    val existingOpenaiApiKey by viewModel.openaiApiKey.collectAsState()
    val existingOpenaiBaseUrl by viewModel.openaiBaseUrl.collectAsState()
    val existingOpenaiModel by viewModel.openaiModel.collectAsState()
    val existingOssRegion by viewModel.ossRegion.collectAsState()
    val existingOssBucket by viewModel.ossBucket.collectAsState()
    val existingOssAccessKeyId by viewModel.ossAccessKeyId.collectAsState()
    val existingOssAccessKeySecret by viewModel.ossAccessKeySecret.collectAsState()
    val existingOssCustomDomain by viewModel.ossCustomDomain.collectAsState()

    // 内部表单状态
    var readwiseToken by remember(existingToken) { mutableStateOf(if (existingToken == "mock_readwise_token" || existingToken == "offline") "" else (existingToken ?: "")) }
    var openaiBaseUrl by remember(existingOpenaiBaseUrl) { mutableStateOf(existingOpenaiBaseUrl.ifBlank { "https://api.openai.com/v1" }) }
    var openaiApiKey by remember(existingOpenaiApiKey) { mutableStateOf(existingOpenaiApiKey) }
    var openaiModel by remember(existingOpenaiModel) { mutableStateOf(existingOpenaiModel.ifBlank { "gpt-4o-mini" }) }
    
    var ossRegion by remember(existingOssRegion) { mutableStateOf(existingOssRegion) }
    var ossBucket by remember(existingOssBucket) { mutableStateOf(existingOssBucket) }
    var ossAccessKeyId by remember(existingOssAccessKeyId) { mutableStateOf(existingOssAccessKeyId) }
    var ossAccessKeySecret by remember(existingOssAccessKeySecret) { mutableStateOf(existingOssAccessKeySecret) }
    var ossCustomDomain by remember(existingOssCustomDomain) { mutableStateOf(existingOssCustomDomain) }

    // 测试状态
    val testLoading by viewModel.testLoading.collectAsState()
    val testResult by viewModel.testResult.collectAsState()
    val ossTestLoading by viewModel.ossTestLoading.collectAsState()
    val ossTestResult by viewModel.ossTestResult.collectAsState()

    val dialogBg = Color(0xFF1C1C1E)

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xBB000000))
            .clickable(enabled = false, onClick = {}),
        contentAlignment = Alignment.Center
    ) {
        val isCompact = maxWidth < 540.dp

        Card(
            modifier = Modifier
                .fillMaxWidth(if (isCompact) 0.96f else 0.92f)
                .fillMaxHeight(if (isCompact) 0.94f else 0.88f)
                .padding(if (isCompact) 6.dp else 12.dp),
            shape = RoundedCornerShape(if (isCompact) 14.dp else 20.dp),
            colors = CardDefaults.cardColors(containerColor = dialogBg),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // ===== 顶栏 (Header) =====
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2C2C2E))
                        .padding(horizontal = if (isCompact) 14.dp else 20.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Brush.linearGradient(listOf(Color(0xFF007AFF), Color(0xFFA78BFA)))),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("Q", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                        Column {
                            Text("ReaderQ 配置向导", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text("第三方 API 凭证引导与测试", color = Color.Gray, fontSize = 11.sp)
                        }
                    }

                    IconButton(onClick = {
                        viewModel.dismissOnboardingWizard()
                        onDismiss()
                    }) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.Gray)
                    }
                }

                // ===== 步进器 (Stepper Header - 水平可滚动，适配折叠屏合上/竖屏) =====
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF141416))
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(if (isCompact) 12.dp else 18.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val steps = listOf("1.欢迎", "2.Readwise", "3.AI引擎", "4.云同步", "5.完成")
                    steps.forEachIndexed { idx, label ->
                        val stepNum = idx + 1
                        val isCurrent = stepNum == step
                        val isDone = stepNum < step

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.clickable(enabled = isDone) { step = stepNum }
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(18.dp)
                                    .clip(CircleShape)
                                    .background(
                                        when {
                                            isCurrent -> Color(0xFF007AFF)
                                            isDone -> Color(0xFF30D158)
                                            else -> Color(0xFF3A3A3C)
                                        }
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                if (isDone) {
                                    Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(12.dp))
                                } else {
                                    Text("$stepNum", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            Text(
                                text = label,
                                color = if (isCurrent) Color.White else if (isDone) Color.LightGray else Color.Gray,
                                fontSize = 11.sp,
                                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                }

                // ===== 内容滚动区域 (Body) =====
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = if (isCompact) 12.dp else 20.dp, vertical = 14.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                    ) {
                        when (step) {
                            1 -> Step1WelcomeContent(isCompact = isCompact)
                            2 -> Step2ReadwiseContent(
                                token = readwiseToken,
                                onTokenChange = { readwiseToken = it },
                                onOpenUrl = { url ->
                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                },
                                onTest = { viewModel.testReadwiseToken(readwiseToken) },
                                viewModel = viewModel
                            )
                            3 -> Step3AiContent(
                                baseUrl = openaiBaseUrl,
                                onBaseUrlChange = { openaiBaseUrl = it },
                                apiKey = openaiApiKey,
                                onApiKeyChange = { openaiApiKey = it },
                                model = openaiModel,
                                onModelChange = { openaiModel = it },
                                onTest = { viewModel.testConfig(openaiApiKey, openaiBaseUrl, openaiModel, 4096) },
                                testLoading = testLoading,
                                testResult = testResult
                            )
                            4 -> Step4OssContent(
                                region = ossRegion,
                                onRegionChange = { ossRegion = it },
                                bucket = ossBucket,
                                onBucketChange = { ossBucket = it },
                                accessKeyId = ossAccessKeyId,
                                onAccessKeyIdChange = { ossAccessKeyId = it },
                                accessKeySecret = ossAccessKeySecret,
                                onAccessKeySecretChange = { ossAccessKeySecret = it },
                                onTest = { viewModel.testOssConfig(ossRegion, ossBucket, ossAccessKeyId, ossAccessKeySecret, ossCustomDomain, "readerq") },
                                ossTestLoading = ossTestLoading,
                                ossTestResult = ossTestResult,
                                onOpenUrl = { url ->
                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                }
                            )
                            5 -> Step5FinishContent(
                                hasReadwise = readwiseToken.isNotBlank(),
                                hasAi = openaiApiKey.isNotBlank(),
                                hasOss = ossAccessKeyId.isNotBlank()
                            )
                        }
                    }
                }

                // ===== 底栏导航按钮 (Footer) =====
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2C2C2E))
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (step > 1) {
                        OutlinedButton(
                            onClick = { step -= 1 },
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("上一步", color = Color.White, fontSize = 12.sp)
                        }
                    } else {
                        Spacer(modifier = Modifier.width(1.dp))
                    }

                    if (step < 5) {
                        Button(
                            onClick = { step += 1 },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF007AFF)),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("下一步", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Button(
                            onClick = {
                                if (readwiseToken.isNotBlank()) {
                                    viewModel.saveToken(readwiseToken)
                                }
                                if (openaiApiKey.isNotBlank()) {
                                    viewModel.saveOpenAiSettings(openaiApiKey, openaiBaseUrl, openaiModel, 4096)
                                }
                                if (ossAccessKeyId.isNotBlank()) {
                                    viewModel.saveOssSettings(ossRegion, ossBucket, ossAccessKeyId, ossAccessKeySecret, ossCustomDomain, "readerq")
                                }
                                viewModel.completeOnboardingWizard()
                                onDismiss()
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF30D158)),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("保存配置并进入 ReaderQ", color = Color.Black, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Step1WelcomeContent(isCompact: Boolean = false) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(10.dp))
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Brush.linearGradient(listOf(Color(0xFF007AFF), Color(0xFFA78BFA)))),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Star, contentDescription = null, tint = Color.White, modifier = Modifier.size(32.dp))
        }
        Spacer(modifier = Modifier.height(14.dp))
        Text("欢迎使用 ReaderQ 智能阅读助手", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(6.dp))
        Text("专为高阶阅读者打造，支持 Readwise 剪藏同步、AI 视频转译与多端无缝协同。", color = Color.Gray, fontSize = 12.sp, textAlign = TextAlign.Center)

        Spacer(modifier = Modifier.height(20.dp))

        val cardItems = listOf(
            Triple("Readwise 同步", "无缝同步剪藏文章正文与高亮划线。", Color(0xFF007AFF)),
            Triple("AI 视频转译", "生成双语精选博客与电影字幕。", Color(0xFFFFD700)),
            Triple("多端云同步", "Android 与 桌面/Web 即时共享。", Color(0xFF30D158))
        )

        if (isCompact) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                cardItems.forEach { (title, desc, color) ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF252528)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(color.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    when (title) {
                                        "Readwise 同步" -> Icons.Default.List
                                        "AI 视频转译" -> Icons.Default.Build
                                        else -> Icons.Default.Share
                                    },
                                    contentDescription = null,
                                    tint = color,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Column {
                                Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text(desc, color = Color.Gray, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                cardItems.forEach { (title, desc, color) ->
                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF252528)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Icon(
                                when (title) {
                                    "Readwise 同步" -> Icons.Default.List
                                    "AI 视频转译" -> Icons.Default.Build
                                    else -> Icons.Default.Share
                                },
                                contentDescription = null,
                                tint = color,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Text(desc, color = Color.Gray, fontSize = 10.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Step2ReadwiseContent(
    token: String,
    onTokenChange: (String) -> Unit,
    onOpenUrl: (String) -> Unit,
    onTest: () -> Unit,
    viewModel: MainViewModel
) {
    val readwiseTestResult by viewModel.readwiseTestResult.collectAsState()
    val readwiseTestError by viewModel.readwiseTestError.collectAsState()
    val readwiseTestLoading by viewModel.readwiseTestLoading.collectAsState()

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Default.List, contentDescription = null, tint = Color(0xFF007AFF))
            Text("配置 Readwise Access Token", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }

        Spacer(modifier = Modifier.height(12.dp))
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E2838)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text("💡 如何获取 Readwise Access Token？", color = Color(0xFF007AFF), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Spacer(modifier = Modifier.height(4.dp))
                Text("1. 在浏览器登录 Readwise 账号。", color = Color.LightGray, fontSize = 11.sp)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("2. 点击前往官方 Token 页面：", color = Color.LightGray, fontSize = 11.sp)
                    Text(
                        text = "https://readwise.io/access_token",
                        color = Color(0xFF007AFF),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.clickable { onOpenUrl("https://readwise.io/access_token") }
                    )
                }
                Text("3. 复制文本框中的 Access Token 并粘贴至下方。", color = Color.LightGray, fontSize = 11.sp)
            }
        }

        Spacer(modifier = Modifier.height(14.dp))
        Text("Readwise Access Token *", color = Color.Gray, fontSize = 11.sp)
        Spacer(modifier = Modifier.height(4.dp))
        OutlinedTextField(
            value = token,
            onValueChange = onTokenChange,
            placeholder = { Text("token_live_xxxxxxxx", color = Color.DarkGray, fontSize = 12.sp) },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Color(0xFF007AFF), unfocusedBorderColor = Color.DarkGray)
        )

        Spacer(modifier = Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(
                onClick = onTest,
                enabled = token.isNotBlank() && !readwiseTestLoading,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF007AFF))
            ) {
                if (readwiseTestLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), color = Color.White, strokeWidth = 2.dp)
                } else {
                    Text("测试 Readwise 连接", color = Color.White, fontSize = 11.sp)
                }
            }

            readwiseTestResult?.let {
                Text(it, color = Color(0xFF30D158), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            readwiseTestError?.let {
                Text(it, color = Color.Red, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun Step3AiContent(
    baseUrl: String,
    onBaseUrlChange: (String) -> Unit,
    apiKey: String,
    onApiKeyChange: (String) -> Unit,
    model: String,
    onModelChange: (String) -> Unit,
    onTest: () -> Unit,
    testLoading: Boolean,
    testResult: TestResult?
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Default.Build, contentDescription = null, tint = Color(0xFFFFD700))
            Text("配置 AI 大模型引擎 (OpenAI / DeepSeek)", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }

        Spacer(modifier = Modifier.height(10.dp))
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF28251E)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(10.dp)) {
                Text("⚡ 快捷预设填入：", color = Color(0xFFFFD700), fontWeight = FontWeight.Bold, fontSize = 11.sp)
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(
                        Triple("OpenAI 官方", "https://api.openai.com/v1", "gpt-4o-mini"),
                        Triple("DeepSeek 官方", "https://api.deepseek.com/v1", "deepseek-chat"),
                        Triple("硅基流动", "https://api.siliconflow.cn/v1", "deepseek-ai/DeepSeek-V3"),
                    ).forEach { (name, url, mod) ->
                        OutlinedButton(
                            onClick = {
                                onBaseUrlChange(url)
                                onModelChange(mod)
                            },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(name, fontSize = 10.sp, color = Color.White)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        Text("Base URL 服务器地址", color = Color.Gray, fontSize = 11.sp)
        OutlinedTextField(
            value = baseUrl,
            onValueChange = onBaseUrlChange,
            modifier = Modifier.fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Color(0xFFFFD700), unfocusedBorderColor = Color.DarkGray)
        )

        Spacer(modifier = Modifier.height(8.dp))
        Text("API Key 密钥 *", color = Color.Gray, fontSize = 11.sp)
        OutlinedTextField(
            value = apiKey,
            onValueChange = onApiKeyChange,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Color(0xFFFFD700), unfocusedBorderColor = Color.DarkGray)
        )

        Spacer(modifier = Modifier.height(8.dp))
        Text("模型名称 (Model)", color = Color.Gray, fontSize = 11.sp)
        OutlinedTextField(
            value = model,
            onValueChange = onModelChange,
            modifier = Modifier.fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Color(0xFFFFD700), unfocusedBorderColor = Color.DarkGray)
        )

        Spacer(modifier = Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(
                onClick = onTest,
                enabled = apiKey.isNotBlank() && !testLoading,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFD700))
            ) {
                if (testLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), color = Color.Black, strokeWidth = 2.dp)
                } else {
                    Text("测试 AI 引擎连接", color = Color.Black, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            testResult?.let {
                if (it.success) {
                    Text("测试成功！", color = Color(0xFF30D158), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                } else {
                    Text(it.reply ?: "失败", color = Color.Red, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun Step4OssContent(
    region: String, onRegionChange: (String) -> Unit,
    bucket: String, onBucketChange: (String) -> Unit,
    accessKeyId: String, onAccessKeyIdChange: (String) -> Unit,
    accessKeySecret: String, onAccessKeySecretChange: (String) -> Unit,
    onTest: () -> Unit,
    ossTestLoading: Boolean,
    ossTestResult: OssTestResult?,
    onOpenUrl: (String) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Default.Share, contentDescription = null, tint = Color(0xFF30D158))
            Text("配置阿里云 OSS 云端同步 (可选)", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text("配置后多端 (Android / 桌面 / Web) 的视频字幕与博客将实现同步。可在 RAM 控制台创建：https://ram.console.aliyun.com", color = Color.Gray, fontSize = 11.sp)

        Spacer(modifier = Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = region, onValueChange = onRegionChange,
                label = { Text("Region 区域", fontSize = 10.sp) },
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = bucket, onValueChange = onBucketChange,
                label = { Text("Bucket 名称", fontSize = 10.sp) },
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(6.dp))
        OutlinedTextField(
            value = accessKeyId, onValueChange = onAccessKeyIdChange,
            label = { Text("AccessKey ID", fontSize = 10.sp) },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(6.dp))
        OutlinedTextField(
            value = accessKeySecret, onValueChange = onAccessKeySecretChange,
            label = { Text("AccessKey Secret", fontSize = 10.sp) },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(
                onClick = onTest,
                enabled = accessKeyId.isNotBlank() && !ossTestLoading,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF30D158))
            ) {
                if (ossTestLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), color = Color.Black, strokeWidth = 2.dp)
                } else {
                    Text("测试 OSS 读写连通", color = Color.Black, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            ossTestResult?.let {
                if (it.success) {
                    Text("OSS 读写成功！", color = Color(0xFF30D158), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                } else {
                    Text(it.error ?: "OSS 失败", color = Color.Red, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun Step5FinishContent(
    hasReadwise: Boolean,
    hasAi: Boolean,
    hasOss: Boolean
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(10.dp))
        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF30D158), modifier = Modifier.size(54.dp))
        Spacer(modifier = Modifier.height(12.dp))
        Text("配置准备就绪！", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text("点击下方按钮保存配置并进入 ReaderQ 主界面。", color = Color.Gray, fontSize = 12.sp)

        Spacer(modifier = Modifier.height(20.dp))
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF252528)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(0.9f)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Readwise 同步", color = Color.White, fontSize = 12.sp)
                    Text(if (hasReadwise) "已配置" else "未配置", color = if (hasReadwise) Color(0xFF30D158) else Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("AI 大模型引擎", color = Color.White, fontSize = 12.sp)
                    Text(if (hasAi) "已配置" else "未配置", color = if (hasAi) Color(0xFF30D158) else Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("阿里云 OSS", color = Color.White, fontSize = 12.sp)
                    Text(if (hasOss) "已配置" else "未配置 (可选)", color = if (hasOss) Color(0xFF30D158) else Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
