import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const API_BASE_URL = "https://multi-doc-rag-assistant.onrender.com";

function shortenFileName(name, maxLength = 30) {
  if (!name) return "";
  if (name.length <= maxLength) return name;

  const extension = name.includes(".") ? name.split(".").pop() : "";
  const baseName = name.replace(`.${extension}`, "");

  return `${baseName.slice(0, maxLength - 8)}...${
    extension ? `.${extension}` : ""
  }`;
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function UploadCard({ onFilesChange }) {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const uploadFilesToBackend = async (files) => {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await fetch(`${API_BASE_URL}/api/upload-multiple`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Could not process these PDFs.");
    }

    return data;
  };

  const validateFiles = (files) => {
    if (!files || files.length === 0) {
      return "Please select at least one PDF file.";
    }

    for (const file of files) {
      if (file.type !== "application/pdf") {
        return "Only PDF files are allowed.";
      }

      if (file.size > MAX_FILE_SIZE) {
        return `${file.name} is too large. Each file must be less than 5MB.`;
      }
    }

    return "";
  };

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setError("");

      const validationError = validateFiles(acceptedFiles);

      if (validationError) {
        setError(validationError);
        return;
      }

      setSelectedFiles(
        acceptedFiles.map((file) => ({
          name: file.name,
          size: file.size,
        })),
      );

      try {
        setIsUploading(true);

        const data = await uploadFilesToBackend(acceptedFiles);

        const filesFromBackend = data.files.map((file, index) => ({
          id: file.id || `${file.name}-${index}`,
          name: file.name,
          size: acceptedFiles[index]?.size,
        }));

        setUploadedFiles(filesFromBackend);
        setSelectedFiles([]);
        onFilesChange(filesFromBackend);
      } catch (err) {
        setUploadedFiles([]);
        setSelectedFiles([]);
        onFilesChange([]);
        setError(err.message || "Upload failed. Please try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [onFilesChange],
  );

  const clearFiles = (event) => {
    event.stopPropagation();

    setUploadedFiles([]);
    setSelectedFiles([]);
    setError("");
    onFilesChange([]);
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    multiple: true,
    disabled: isUploading,
    noClick: true,
  });

  const hasFiles = uploadedFiles.length > 0;
  const hasSelectedFiles = selectedFiles.length > 0;

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`group relative overflow-hidden rounded-3xl border p-5 text-center transition duration-300
        ${
          error
            ? "border-red-400/40 bg-red-500/10"
            : hasFiles
              ? "border-emerald-400/40 bg-emerald-400/10"
              : isDragActive
                ? "border-cyan-300/60 bg-cyan-300/10"
                : "border-white/10 bg-black/20 hover:border-cyan-300/30"
        }
        ${isUploading ? "cursor-not-allowed opacity-75" : "cursor-pointer"}`}
      >
        <input {...getInputProps()} />

        <div className="absolute inset-0 bg-gradient-to-br from-cyan-300/0 via-violet-500/0 to-fuchsia-500/0 opacity-0 transition group-hover:opacity-100 group-hover:from-cyan-300/5 group-hover:via-violet-500/5 group-hover:to-fuchsia-500/5" />

        <div className="relative">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl
            ${
              error
                ? "bg-red-400/10"
                : hasFiles
                  ? "bg-emerald-400/10"
                  : "bg-white/5"
            }`}
          >
            {isUploading ? "⏳" : error ? "⚠️" : hasFiles ? "✓" : "📄"}
          </div>

          <h3 className="mb-1.5 text-base font-bold">
            {isUploading
              ? "Indexing documents"
              : error
                ? "Upload failed"
                : hasFiles
                  ? `${uploadedFiles.length} PDF${
                      uploadedFiles.length > 1 ? "s" : ""
                    } indexed`
                  : "Upload PDFs"}
          </h3>

          <p
            className={`mx-auto max-w-[260px] text-sm leading-6 ${
              error ? "text-red-300" : "text-slate-400"
            }`}
          >
            {isUploading
              ? "Extracting text, chunking content, and creating embeddings..."
              : error
                ? error
                : hasFiles
                  ? "Your documents are ready. Ask questions or compare them."
                  : "Drag and drop multiple PDFs here, or browse from your device."}
          </p>

          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                open();
              }}
              disabled={isUploading}
              className="rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-[0_0_22px_rgba(56,189,248,0.28)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {hasFiles ? "Replace PDFs" : "Choose PDFs"}
            </button>

            {hasFiles && (
              <button
                type="button"
                onClick={clearFiles}
                disabled={isUploading}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:border-red-300/30 hover:bg-red-400/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>

          {isUploading && (
            <div className="mt-5 overflow-hidden rounded-full bg-white/10">
              <div className="h-1.5 w-2/3 animate-[loadingBar_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-sky-400 to-indigo-500" />
            </div>
          )}
        </div>
      </div>

      {hasSelectedFiles && (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
          <p className="mb-2 px-1 text-xs font-semibold text-slate-400">
            Selected files
          </p>

          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <div className="min-w-0">
                  <p
                    title={file.name}
                    className="truncate text-xs font-semibold text-slate-200"
                  >
                    {shortenFileName(file.name)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>

                <span className="shrink-0 rounded-full bg-sky-300/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200">
                  queued
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasFiles && (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
          <p className="mb-2 px-1 text-xs font-semibold text-slate-400">
            Indexed documents
          </p>

          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={file.id || `${file.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-emerald-300/20 hover:bg-emerald-300/5"
              >
                <div className="min-w-0">
                  <p
                    title={file.name}
                    className="truncate text-xs font-semibold text-slate-200"
                  >
                    {shortenFileName(file.name)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {file.size ? formatFileSize(file.size) : "PDF document"}
                  </p>
                </div>

                <span className="shrink-0 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  indexed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes loadingBar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(35%);
          }
          100% {
            transform: translateX(155%);
          }
        }
      `}</style>
    </div>
  );
}

export default UploadCard;
