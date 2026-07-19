package com.readerq.app.api

import android.util.Base64
import io.ktor.client.*
import io.ktor.client.engine.android.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import java.text.SimpleDateFormat
import java.util.*
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class OssClient(
    private val region: String,
    private val bucket: String,
    private val accessKeyId: String,
    private val accessKeySecret: String,
    private val customDomain: String?,
    private val pathPrefix: String
) {
    private val client = HttpClient(Android)

    private fun generateSignature(method: String, contentType: String, date: String, resource: String): String {
        val stringToSign = "$method\n\n$contentType\n$date\n$resource"
        val signingKey = SecretKeySpec(accessKeySecret.toByteArray(), "HmacSHA1")
        val mac = Mac.getInstance("HmacSHA1")
        mac.init(signingKey)
        val rawHmac = mac.doFinal(stringToSign.toByteArray())
        return Base64.encodeToString(rawHmac, Base64.NO_WRAP)
    }

    suspend fun uploadImage(imageBytes: ByteArray, documentId: String, fileName: String): String {
        val ext = if (fileName.contains(".")) fileName.substring(fileName.lastIndexOf(".")) else ".jpg"
        val objectKey = "${pathPrefix.trim().removeSuffix("/")}/$documentId/${System.currentTimeMillis()}_${(1000..9999).random()}$ext"
        
        val contentType = when (ext.lowercase()) {
            ".png" -> "image/png"
            ".gif" -> "image/gif"
            ".webp" -> "image/webp"
            else -> "image/jpeg"
        }

        val sdf = SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("GMT")
        val dateStr = sdf.format(Date())

        val resource = "/$bucket/$objectKey"
        val signature = generateSignature("PUT", contentType, dateStr, resource)
        val authHeader = "OSS $accessKeyId:$signature"

        val endpoint = "https://$bucket.$region.aliyuncs.com/$objectKey"
        val response = client.put(endpoint) {
            header("Authorization", authHeader)
            header("Content-Type", contentType)
            header("Date", dateStr)
            setBody(imageBytes)
        }

        if (response.status.isSuccess()) {
            return if (!customDomain.isNullOrBlank()) {
                val cleanedDomain = customDomain.trim().removeSuffix("/")
                val protocol = if (cleanedDomain.startsWith("http")) "" else "https://"
                "$protocol$cleanedDomain/$objectKey"
            } else {
                endpoint
            }
        } else {
            val errText = response.bodyAsText()
            throw Exception("OSS 上传失败 (${response.status.value}): $errText")
        }
    }

    private fun buildPublicUrl(objectKey: String): String {
        return if (!customDomain.isNullOrBlank()) {
            val cleanedDomain = customDomain.trim().removeSuffix("/")
            val protocol = if (cleanedDomain.startsWith("http")) "" else "https://"
            "$protocol$cleanedDomain/$objectKey"
        } else {
            "https://$bucket.$region.aliyuncs.com/$objectKey"
        }
    }

    private fun getSubtitleObjectKey(documentId: String): String {
        return "${pathPrefix.trim().removeSuffix("/")}/subtitles/$documentId.srt"
    }

    /**
     * 上传 SRT 字幕到 OSS（跨客户端同步）
     */
    suspend fun uploadSubtitle(documentId: String, srtContent: String): String {
        val objectKey = getSubtitleObjectKey(documentId)
        val contentType = "text/plain; charset=utf-8"
        val fileBytes = srtContent.toByteArray(Charsets.UTF_8)

        val sdf = SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("GMT")
        val dateStr = sdf.format(Date())

        val resource = "/$bucket/$objectKey"
        val signature = generateSignature("PUT", contentType, dateStr, resource)
        val authHeader = "OSS $accessKeyId:$signature"

        val endpoint = "https://$bucket.$region.aliyuncs.com/$objectKey"
        val response = client.put(endpoint) {
            header("Authorization", authHeader)
            header("Content-Type", contentType)
            header("Date", dateStr)
            setBody(fileBytes)
        }

        if (response.status.isSuccess()) {
            return buildPublicUrl(objectKey)
        } else {
            val errText = response.bodyAsText()
            throw Exception("OSS 字幕上传失败 (${response.status.value}): $errText")
        }
    }

    /**
     * 从 OSS 下载字幕文件
     */
    suspend fun downloadSubtitle(documentId: String): String? {
        val objectKey = getSubtitleObjectKey(documentId)
        val ossUrl = buildPublicUrl(objectKey)

        return try {
            val response = client.get(ossUrl)
            if (response.status.isSuccess()) {
                val text = response.bodyAsText()
                if (text.isBlank()) null else text
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * 从 OSS 删除字幕文件
     */
    suspend fun deleteSubtitle(documentId: String) {
        val objectKey = getSubtitleObjectKey(documentId)

        val sdf = SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("GMT")
        val dateStr = sdf.format(Date())

        val resource = "/$bucket/$objectKey"
        val signature = generateSignature("DELETE", "", dateStr, resource)
        val authHeader = "OSS $accessKeyId:$signature"

        val endpoint = "https://$bucket.$region.aliyuncs.com/$objectKey"
        try {
            client.delete(endpoint) {
                header("Authorization", authHeader)
                header("Date", dateStr)
            }
        } catch (e: Exception) {
            // 忽略删除失败（可能文件不存在）
        }
    }
}
