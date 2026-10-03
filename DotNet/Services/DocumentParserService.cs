using System.Text;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using UglyToad.PdfPig;

namespace MsSqlVectorRag.Services;

public interface IDocumentParserService
{
    Task<string> ExtractTextAsync(Stream stream, string fileName);
    List<string> ChunkText(string text, int targetChunkChars = 600, int overlapChars = 100);
}

public class DocumentParserService : IDocumentParserService
{
    public async Task<string> ExtractTextAsync(Stream stream, string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();

        if (ext == ".pdf")
        {
            return ExtractFromPdf(stream);
        }
        else if (ext == ".docx")
        {
            return ExtractFromDocx(stream);
        }
        else
        {
            // Plain text, Markdown, JSON, CSV
            using var reader = new StreamReader(stream, Encoding.UTF8);
            return await reader.ReadToEndAsync();
        }
    }

    private string ExtractFromPdf(Stream stream)
    {
        var sb = new StringBuilder();
        using var pdf = PdfDocument.Open(stream);
        foreach (var page in pdf.GetPages())
        {
            sb.AppendLine(page.Text);
        }
        return sb.ToString().Trim();
    }

    private string ExtractFromDocx(Stream stream)
    {
        var sb = new StringBuilder();
        using var wordDoc = WordprocessingDocument.Open(stream, false);
        var body = wordDoc.MainDocumentPart?.Document?.Body;
        if (body != null)
        {
            foreach (var para in body.Elements<Paragraph>())
            {
                sb.AppendLine(para.InnerText);
            }
        }
        return sb.ToString().Trim();
    }

    public List<string> ChunkText(string text, int targetChunkChars = 600, int overlapChars = 100)
    {
        var paragraphs = text.Split(new[] { "\r\n\r\n", "\n\n" }, StringSplitOptions.RemoveEmptyEntries);
        var chunks = new List<string>();
        var currentChunk = new StringBuilder();

        foreach (var rawPara in paragraphs)
        {
            var para = rawPara.Trim();
            if (string.IsNullOrWhiteSpace(para)) continue;

            if (currentChunk.Length + para.Length + 2 <= targetChunkChars)
            {
                if (currentChunk.Length > 0) currentChunk.Append("\n\n");
                currentChunk.Append(para);
            }
            else
            {
                if (currentChunk.Length > 30)
                {
                    chunks.Add(currentChunk.ToString());
                }
                currentChunk.Clear();
                currentChunk.Append(para);
            }
        }

        if (currentChunk.Length > 30)
        {
            chunks.Add(currentChunk.ToString());
        }

        if (chunks.Count == 0 && text.Length > 0)
        {
            chunks.Add(text);
        }

        return chunks;
    }
}
