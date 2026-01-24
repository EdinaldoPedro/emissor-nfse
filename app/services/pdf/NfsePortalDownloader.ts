import { chromium } from 'playwright';
import { extractCertAndKeyFromPfx } from '@/app/utils/certHelper';

export class NfsePortalDownloader {

    async downloadPdfOficial(chaveAcesso: string, pfxBase64: string, senhaCertificado: string): Promise<Buffer> {
        console.log(`[BOT] Iniciando download oficial para chave: ${chaveAcesso}`);

        const credenciais = extractCertAndKeyFromPfx(pfxBase64, senhaCertificado);

        const URL_LOGIN = "https://www.nfse.gov.br/EmissorNacional/Login?ReturnUrl=%2fEmissorNacional";
        const URL_DOWNLOAD = `https://www.nfse.gov.br/EmissorNacional/Notas/Download/DANFSe/${chaveAcesso}`;

        const browser = await chromium.launch({ 
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });

        try {
            const context = await browser.newContext({
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                ignoreHTTPSErrors: true,
                clientCertificates: [{
                    origin: "https://www.nfse.gov.br",
                    cert: credenciais.cert,
                    key: credenciais.key
                }]
            });

            const page = await context.newPage();

            // --- ETAPA 1: LOGIN ---
            console.log("[BOT] 1. Acessando página de Login...");
            await page.goto(URL_LOGIN, { timeout: 60000 });
            
            // OTIMIZAÇÃO: Reduzido de 2000ms para 500ms (Apenas estabilização mínima)
            await page.waitForTimeout(500); 

            console.log("[BOT] Clicando na opção 'Certificado Digital'...");
            try {
                // Tenta seletores visuais primeiro
                await page.click("img[src*='ertificado'], a[href*='Certificado']", { timeout: 5000 });
            } catch {
                // Fallback por texto
                await page.getByText("ACESSO COM CERTIFICADO DIGITAL").first().click();
            }

            console.log("[BOT] Aguardando autenticação...");
            // OTIMIZAÇÃO CRÍTICA: Removido o wait de 5s fixo.
            // A função waitForURL abaixo já vai esperar o tempo necessário (seja 1s ou 10s).
            // Adicionado apenas 1s de margem de segurança para cookies.
            await page.waitForTimeout(1000); 

            try {
                // Espera sair da tela de Login (sinal de sucesso)
                await page.waitForURL((url) => !url.toString().includes("Login"), { timeout: 30000 });
                console.log("[BOT] ✅ Login detectado (URL mudou).");
            } catch (e) {
                if (page.url().includes("Login")) {
                    throw new Error("Falha no Login: O sistema não saiu da tela de autenticação.");
                }
            }

            // --- ETAPA 2: DOWNLOAD ---
            console.log(`[BOT] 2. Acessando link direto: ${URL_DOWNLOAD}`);

            // Prepara o gatilho de download
            const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

            try {
                await page.goto(URL_DOWNLOAD, { timeout: 15000 });
            } catch (e) {
                console.log("[BOT] Navegação interrompida pelo início do download (Esperado).");
            }

            const download = await downloadPromise;
            
            console.log("[BOT] ⏳ Processando stream...");
            // OTIMIZAÇÃO: Removido o wait de 2000ms. O stream já está disponível.

            const fileStream = await download.createReadStream();
            const chunks = [];
            for await (const chunk of fileStream) {
                chunks.push(chunk);
            }
            const pdfBuffer = Buffer.concat(chunks);
            
            console.log(`[BOT] 🎉 SUCESSO! PDF capturado (${pdfBuffer.length} bytes).`);
            
            return pdfBuffer;

        } catch (error: any) {
            console.error("[BOT CRITICAL]", error);
            throw new Error(`Erro no Robô: ${error.message}`);
        } finally {
            await browser.close();
        }
    }
}