import { useState, useRef, useEffect } from "react";
import { BrowserQRCodeReader } from "@zxing/library";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Camera, Upload, X } from "lucide-react";

interface QRCodeScannerProps {
  onResult: (data: string) => void;
  onClose: () => void;
}

export default function QRCodeScanner({ onResult, onClose }: QRCodeScannerProps) {
  const [activeTab, setActiveTab] = useState<string>("camera");
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraAvailable(false);
      setActiveTab("upload");
    }
  }, []);

  useEffect(() => {
    if (activeTab === "camera" && cameraAvailable) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeTab, cameraAvailable]);

  function stopCamera() {
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    setScanning(false);
  }

  async function startCamera() {
    if (!videoRef.current) return;
    setScanning(true);
    try {
      const codeReader = new BrowserQRCodeReader();
      readerRef.current = codeReader;
      await codeReader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error) => {
          if (result) {
            stopCamera();
            onResult(result.getText());
          }
          // ignore decode errors — they fire continuously while scanning
        }
      );
    } catch (err: any) {
      setScanning(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast({
          title: "Câmera bloqueada",
          description: "Permita o acesso à câmera nas configurações do navegador.",
          variant: "destructive",
        });
        setCameraAvailable(false);
        setActiveTab("upload");
      } else {
        toast({ title: "Erro ao acessar câmera", description: err.message, variant: "destructive" });
      }
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Erro ao carregar imagem"));
      });
      const codeReader = new BrowserQRCodeReader();
      const result = await codeReader.decodeFromImageElement(img);
      URL.revokeObjectURL(url);
      onResult(result.getText());
    } catch (err: any) {
      toast({
        title: "QR Code não encontrado",
        description: "Não foi possível detectar um QR Code na imagem. Tente outra imagem.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Escanear QR Code PIX</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            {cameraAvailable && (
              <TabsTrigger value="camera" className="flex-1 gap-2">
                <Camera className="h-4 w-4" />
                Câmera
              </TabsTrigger>
            )}
            <TabsTrigger value="upload" className="flex-1 gap-2">
              <Upload className="h-4 w-4" />
              Upload de Imagem
            </TabsTrigger>
          </TabsList>

          {cameraAvailable && (
            <TabsContent value="camera" className="mt-4">
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "1" }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-white/70 rounded-lg">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-center text-sm text-muted-foreground mt-3">
                {scanning ? "Aponte para o QR Code PIX..." : "Iniciando câmera..."}
              </p>
            </TabsContent>
          )}

          <TabsContent value="upload" className="mt-4">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-medium">Clique para selecionar uma imagem</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP com QR Code PIX</p>
              {uploading && <p className="text-xs text-blue-600 mt-2">Processando imagem...</p>}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
