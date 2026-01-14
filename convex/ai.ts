import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const streamChat = action({
  args: { 
    documentId: v.id("documents"),
    message: v.string(),
    documentContent: v.string() 
  },
  handler: async (ctx, args) => {
    // Add user message to database
    await ctx.runMutation(api.messages.send, {
      documentId: args.documentId,
      content: args.message,
    });
    
    // Create system prompt for document editing context
    const systemPrompt = `You are an AI assistant helping with document editing. The current document content is:

${args.documentContent}

You can help users edit, improve, or modify their document. When making changes to the document, use this format:

For chat responses (explanations, questions, etc.), just respond normally.

For document edits, use this format:
<DOCUMENT_EDIT>
<ACTION>replace|insert|append</ACTION>
<TARGET>section-id or "full" for entire document</TARGET>
<CONTENT>
The new content here
</CONTENT>
</DOCUMENT_EDIT>

If the document is empty, use ACTION "full" to create the entire document.
For existing documents, use section IDs like "section-1", "section-2", etc.
You can also use "append" to add new content at the end.

Always provide helpful explanations along with your edits.`;

    // Stream response from custom LLM endpoint
    const response = await fetch("https://llm-gateway.hahomelabs.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer sk-GJlXKCzdT-LNopC-hWTsxA`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "zai/glm-4.6",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: args.message }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.statusText}`);
    }

    let fullResponse = "";
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    }

    // Parse response for document edits and chat content
    const documentEditRegex = /<DOCUMENT_EDIT>([\s\S]*?)<\/DOCUMENT_EDIT>/g;
    const edits = [];
    let chatResponse = fullResponse;
    
    let match;
    while ((match = documentEditRegex.exec(fullResponse)) !== null) {
      const editContent = match[1];
      const actionMatch = editContent.match(/<ACTION>(.*?)<\/ACTION>/);
      const targetMatch = editContent.match(/<TARGET>(.*?)<\/TARGET>/);
      const contentMatch = editContent.match(/<CONTENT>([\s\S]*?)<\/CONTENT>/);
      
      if (actionMatch && targetMatch && contentMatch) {
        edits.push({
          action: actionMatch[1].trim(),
          target: targetMatch[1].trim(),
          content: contentMatch[1].trim()
        });
        
        // Remove the edit from chat response
        chatResponse = chatResponse.replace(match[0], '').trim();
      }
    }

    // Save complete assistant response (chat part only)
    await ctx.runMutation(api.messages.addAssistantMessage, {
      documentId: args.documentId,
      content: chatResponse || "I've made the requested changes to your document.",
    });

    return { 
      response: chatResponse || "I've made the requested changes to your document.",
      edits: edits
    };
  },
});
