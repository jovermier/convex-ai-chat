import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { DocumentList } from "./DocumentList";
import { ChatPane } from "./ChatPane";
import { EditorPane } from "./EditorPane";
import { toast } from "sonner";
import { addSectionIds } from "../lib/documentUtils";

export function DocumentEditor() {
  const [selectedDocumentId, setSelectedDocumentId] = useState<Id<"documents"> | null>(null);
  const [documentContent, setDocumentContent] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  
  const documents = useQuery(api.documents.list);
  const selectedDocument = useQuery(
    api.documents.get,
    selectedDocumentId ? { id: selectedDocumentId } : "skip"
  );
  
  const createDocument = useMutation(api.documents.create);
  const updateDocument = useMutation(api.documents.update);

  // Auto-select first document or create one if none exist
  useEffect(() => {
    if (documents && documents.length > 0 && !selectedDocumentId) {
      setSelectedDocumentId(documents[0]._id);
    } else if (documents && documents.length === 0) {
      handleCreateDocument();
    }
  }, [documents, selectedDocumentId]);

  // Update local state when document changes
  useEffect(() => {
    if (selectedDocument) {
      // Ensure content has section IDs for AI targeting
      const contentWithIds = selectedDocument.content ? addSectionIds(selectedDocument.content) : "";
      setDocumentContent(contentWithIds);
      setDocumentTitle(selectedDocument.title);
      
      // Update the document in database if IDs were added
      if (contentWithIds !== selectedDocument.content && contentWithIds.trim()) {
        updateDocument({
          id: selectedDocument._id,
          content: contentWithIds,
        });
      }
    }
  }, [selectedDocument]);

  const handleCreateDocument = async () => {
    try {
      const id = await createDocument({
        title: "Untitled Document",
        content: "",
      });
      setSelectedDocumentId(id);
      toast.success("New document created");
    } catch (error) {
      toast.error("Failed to create document");
    }
  };

  const handleSaveDocument = async () => {
    if (!selectedDocumentId) return;
    
    try {
      await updateDocument({
        id: selectedDocumentId,
        title: documentTitle,
        content: documentContent,
      });
      toast.success("Document saved");
    } catch (error) {
      toast.error("Failed to save document");
    }
  };

  // Auto-save every 5 seconds
  useEffect(() => {
    if (!selectedDocumentId || !selectedDocument) return;
    
    const interval = setInterval(() => {
      if (documentContent !== selectedDocument.content || documentTitle !== selectedDocument.title) {
        handleSaveDocument();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedDocumentId, selectedDocument, documentContent, documentTitle]);

  if (!documents) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Document List Sidebar */}
      <div className="w-64 border-r bg-white">
        <DocumentList
          documents={documents}
          selectedDocumentId={selectedDocumentId}
          onSelectDocument={setSelectedDocumentId}
          onCreateDocument={handleCreateDocument}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Chat Pane */}
        <div className="w-1/2 border-r">
          <ChatPane
            documentId={selectedDocumentId}
            documentContent={documentContent}
            onApplyEdit={(newContent) => setDocumentContent(newContent)}
          />
        </div>

        {/* Editor Pane */}
        <div className="w-1/2">
          <EditorPane
            title={documentTitle}
            content={documentContent}
            onTitleChange={setDocumentTitle}
            onContentChange={setDocumentContent}
            onSave={handleSaveDocument}
          />
        </div>
      </div>
    </div>
  );
}
