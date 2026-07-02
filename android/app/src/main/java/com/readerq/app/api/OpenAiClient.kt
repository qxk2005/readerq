package com.readerq.app.api

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class OpenAiMessage(val role: String, val content: String)

@Serializable
data class OpenAiRequest(
    val model: String,
    val messages: List<OpenAiMessage>,
    val temperature: Float = 0.5f,
    val max_tokens: Int = 4096,
    val stream: Boolean = false
)

@Serializable
data class OpenAiChoice(val message: OpenAiMessage)

@Serializable
data class OpenAiResponse(val choices: List<OpenAiChoice>)

class OpenAiClient(
    private val apiKey: String,
    private val baseUrl: String,
    private val model: String
) {
    private val client = HttpClient(Android) {
        install(ContentNegotiation) {
            json(Json { 
                ignoreUnknownKeys = true 
                coerceInputValues = true
            })
        }
    }

    suspend fun getCompletion(messages: List<OpenAiMessage>, systemPrompt: String? = null): String {
        val finalMessages = mutableListOf<OpenAiMessage>()
        if (systemPrompt != null) {
            finalMessages.add(OpenAiMessage("system", systemPrompt))
        }
        finalMessages.addAll(messages)

        val requestBody = OpenAiRequest(
            model = model.trim(),
            messages = finalMessages
        )

        // Make sure base URL endpoints correctly
        var url = baseUrl.trim()
        if (!url.endsWith("/")) {
            url += "/"
        }
        url += "chat/completions"

        val response = client.post(url) {
            header(HttpHeaders.Authorization, "Bearer ${apiKey.trim()}")
            header(HttpHeaders.ContentType, ContentType.Application.Json)
            setBody(requestBody)
        }

        if (response.status.isSuccess()) {
            val responseData: OpenAiResponse = response.body()
            return responseData.choices.firstOrNull()?.message?.content ?: "无法生成回复"
        } else {
            val errText = response.bodyAsText()
            throw Exception("OpenAI API 错误 (${response.status.value}): $errText")
        }
    }
}
