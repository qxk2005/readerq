import java.util.Properties
import java.io.File

// 从根目录的 package.json 动态获取版本号
val packageJsonFile = project.rootProject.file("../package.json")
var appVersionName = "1.0.58"
var appVersionCode = 58

if (packageJsonFile.exists()) {
    try {
        val text = packageJsonFile.readText()
        val matchResult = Regex("\"version\"\\s*:\\s*\"([^\"]+)\"").find(text)
        if (matchResult != null) {
            appVersionName = matchResult.groupValues[1]
            // 将 1.0.58 转换为 10058 (x * 10000 + y * 100 + z) 或直接取最末尾的数字作为 Code
            // 之前的 versionCode 是 54，这里如果 1.0.58 用末尾 58 也可以。为防止以后 y 位（小版本）变动，我们可以用 x * 10000 + y * 100 + z
            // 但如果之前是 54，我们用 x*10000 + y*100 + z => 1*10000 + 0*100 + 54 = 10054，这比 54 大。
            // 这样无论如何 versionCode 都会递增。
            // 为了安全起见，这里直接用分段解析：比如 1.0.58 解析出来最后一段作为 58，或者使用更先进的组合算法。
            // 由于之前的 versionCode 都是直接对应的第3段 (如 1.0.54 对应 54)，我们也可以使用分段组合：
            val parts = appVersionName.split(".")
            if (parts.size >= 3) {
                val major = parts[0].toIntOrNull() ?: 1
                val minor = parts[1].toIntOrNull() ?: 0
                val patch = parts[2].toIntOrNull() ?: 58
                // 使用组合方式，保证 versionCode 总是大于 54，且随版本变化递增
                // 例如 1.0.58 => 10000 + 58 = 10058
                appVersionCode = major * 10000 + minor * 100 + patch
            }
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("kotlin-kapt")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.readerq.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "readerq.qiuyang.ai"
        minSdk = 26
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    val keystorePropertiesFile = rootProject.file("keystore.properties")
    val keystoreProperties = Properties()
    if (keystorePropertiesFile.exists()) {
        keystoreProperties.load(keystorePropertiesFile.inputStream().reader(Charsets.UTF_8))
    }

    signingConfigs {
        create("shared") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        create("release") {
            if (keystorePropertiesFile.exists()) {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            } else {
                storeFile = file("debug.keystore")
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            signingConfig = signingConfigs.getByName("shared")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")

    // Compose
    val composeBom = platform("androidx.compose:compose-bom:2023.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material3:material3-window-size-class")

    // Foldable support (WindowManager)
    implementation("androidx.window:window:1.2.0")

    // Room Database
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    kapt("androidx.room:room-compiler:$roomVersion")

    // Ktor HttpClient
    val ktorVersion = "2.3.7"
    implementation("io.ktor:ktor-client-core:$ktorVersion")
    implementation("io.ktor:ktor-client-android:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")
    implementation("io.ktor:ktor-client-logging:$ktorVersion")

    // Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")

    // Coil Image Loader
    implementation("io.coil-kt:coil-compose:2.5.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:2023.10.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
