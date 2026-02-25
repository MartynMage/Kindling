import { FolderOpen, FileText } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

interface FileUploadProps {
  path: string;
  onPathChange: (path: string) => void;
}

export default function FileUpload({ path, onPathChange }: FileUploadProps) {
  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select training documents folder",
      });
      if (selected && typeof selected === "string") {
        onPathChange(selected);
      }
    } catch {
      // User cancelled
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleBrowse}
        className="w-full flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-surface-border rounded-xl hover:border-accent/40 hover:bg-accent/5 transition-colors cursor-pointer"
      >
        <FolderOpen className="h-8 w-8 text-foreground-muted" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {path ? "Change folder" : "Select a folder"}
          </p>
          <p className="text-xs text-foreground-muted mt-1">
            Supports .txt and .md files
          </p>
        </div>
      </button>

      {path && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-surface border border-surface-border rounded-lg">
          <FileText className="h-4 w-4 text-accent shrink-0" />
          <span className="text-sm text-foreground truncate">{path}</span>
        </div>
      )}
    </div>
  );
}
