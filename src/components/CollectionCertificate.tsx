import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import {
  canShareCertificate,
  CERTIFICATE_FILENAME,
  createCertificate,
  shareCertificate,
} from "../lib/collection-certificate";

export function CollectionCertificate({
  total,
  onClose,
}: {
  total: number;
  onClose: () => void;
}) {
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState("");
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let url: string | undefined;
    setError(false);
    createCertificate(total)
      .then((file) => {
        if (disposed) return;
        url = URL.createObjectURL(file);
        setImage({ file, url });
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [total, attempt]);
  const shareable = image && canShareCertificate(image.file, navigator);
  const share = async () => {
    if (!image || sharing) return;
    setSharing(true);
    setStatus("");
    const result = await shareCertificate(image.file, navigator);
    if (result === "failed" || result === "unavailable")
      setStatus(
        "Sharing is unavailable here. Save the image, then add it to your Instagram post.",
      );
    setSharing(false);
  };
  return (
    <div className="modal-backdrop certificate-backdrop" onClick={onClose}>
      <section
        className="certificate-modal popup-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="certificate-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="icon-button detail-close"
          aria-label="Close certificate"
          onClick={onClose}
        >
          <X size={22} />
        </button>
        <div className="certificate-scroll">
          <div className="eyebrow">ALL {total} LIGHTS COLLECTED</div>
          <h2 id="certificate-title">Your golden certificate.</h2>
          {image ? (
            <img
              className="certificate-image"
              src={image.url}
              alt={`River of Light Liverpool 2026. ${total} of ${total} lights. I collected every light. Unofficial explorer certificate.`}
            />
          ) : (
            <div className="certificate-loading" role="status">
              {error
                ? "We couldn’t prepare your certificate."
                : "Adding a little gold…"}
              {error && (
                <button onClick={() => setAttempt((value) => value + 1)}>
                  Try again
                </button>
              )}
            </div>
          )}
          {image && (
            <div className="certificate-actions">
              {shareable && (
                <button
                  className="primary-button"
                  onClick={share}
                  disabled={sharing}
                >
                  <Share2 size={18} />
                  {sharing ? "Sharing…" : "Share certificate"}
                </button>
              )}
              <a
                className={shareable ? "certificate-save" : "primary-button"}
                href={image.url}
                download={CERTIFICATE_FILENAME}
              >
                <Download size={18} />
                {shareable ? "Save image" : "Save for Instagram"}
              </a>
            </div>
          )}
          <p className="certificate-hint">
            {shareable
              ? "Choose Instagram in your share sheet, or save the image to post later."
              : "Save your certificate, then add it to a post or story in Instagram."}
          </p>
          <p className="certificate-status" role="status">
            {status}
          </p>
        </div>
      </section>
    </div>
  );
}
