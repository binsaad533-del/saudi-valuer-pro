import { QRCodeSVG } from "qrcode.react";
import { Copy, CheckCircle2, Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface QRCodeGeneratorProps {
  referenceNumber: string;
  verificationToken?: string;
  reportDate?: string;
  size?: number;
}

export default function QRCodeGenerator({
  referenceNumber,
  verificationToken,
  reportDate,
  size = 160,
}: QRCodeGeneratorProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const verificationUrl = `${window.location.origin}/verify/${verificationToken || referenceNumber}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
    toast({ title: "تم نسخ رابط التحقق" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const svg = document.getElementById("report-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new window.Image();

    img.onload = () => {
      canvas.width = size * 2;
      canvas.height = size * 2;
      ctx?.drawImage(img, 0, 0, size * 2, size * 2);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `QR_${referenceNumber}.png`;
      a.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          رمز التحقق
        </h3>

        <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-muted/30">
          <QRCodeSVG
            id="report-qr-code"
            value={verificationUrl}
            size={size}
            level="H"
            bgColor="transparent"
            fgColor="currentColor"
            className="text-foreground print:text-black"
            includeMargin
          />

          <div className="text-center space-y-1">
            <p className="text-xs font-medium text-foreground">{referenceNumber}</p>
            {reportDate && (
              <p className="text-xs text-muted-foreground">{reportDate}</p>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground text-center max-w-[220px] break-all leading-relaxed">
            {verificationUrl}
          </p>

          <Badge variant="outline" className="text-xs gap-1">
            <CheckCircle2 className="w-3 h-3" /> جاهز للتحقق
          </Badge>

          <div className="flex items-center gap-2 w-full">
            <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={handleCopy}>
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "تم النسخ" : "نسخ الرابط"}
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5" />
              تحميل QR
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
