import { BadRequestException, Injectable } from "@nestjs/common";
import * as mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { BRIEF_ATTACHMENT_CONTENT_TYPES } from "./dto/performance-brief-attachment.dto.js";

const MAX_EXTRACTED_TEXT_CHARACTERS = 100_000;

@Injectable()
export class BriefContentExtractorService {
  async extract(contentType: string, bytes: Uint8Array): Promise<string> {
    let text: string;

    if (contentType === "application/pdf") {
      text = await this.extractPdf(bytes);
    } else if (
      contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      text = await this.extractDocx(bytes);
    } else if (contentType === "text/plain") {
      text = this.extractText(bytes);
    } else {
      throw new BadRequestException(
        `Unsupported brief type. Use ${BRIEF_ATTACHMENT_CONTENT_TYPES.join(", ")}.`,
      );
    }

    const normalized = text.replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n");
    const cleaned = Array.from(normalized)
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint === 9 || codePoint === 10 || (codePoint >= 32 && codePoint !== 127);
      })
      .join("")
      .trim();

    if (!cleaned) {
      throw new BadRequestException("No readable text was found in the production brief.");
    }

    if (cleaned.length > MAX_EXTRACTED_TEXT_CHARACTERS) {
      throw new BadRequestException(
        "The production brief contains too much text. Use a document under 100,000 characters.",
      );
    }

    return cleaned;
  }

  private async extractPdf(bytes: Uint8Array): Promise<string> {
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      throw new BadRequestException("The uploaded file is not a valid PDF.");
    }

    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      return result.text;
    } catch {
      throw new BadRequestException("The PDF could not be parsed.");
    } finally {
      await parser.destroy();
    }
  }

  private async extractDocx(bytes: Uint8Array): Promise<string> {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      throw new BadRequestException("The uploaded file is not a valid DOCX document.");
    }

    try {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return result.value;
    } catch {
      throw new BadRequestException("The DOCX document could not be parsed.");
    }
  }

  private extractText(bytes: Uint8Array): string {
    if (bytes.includes(0)) {
      throw new BadRequestException("The uploaded TXT file appears to contain binary data.");
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new BadRequestException("The TXT file must use UTF-8 text encoding.");
    }
  }
}
