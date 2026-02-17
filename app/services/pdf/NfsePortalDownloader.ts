import { chromium } from 'playwright';
import { decrypt } from '@/app/utils/crypto';
import forge from 'node-forge';

export class NfsePortalDownloader {

    /**
     * Extrai credenciais usando a lógica Node-Forge (Compatível com seu certificado)
     */
    private extrairCredenciaisLocal(pfxBase64: string, senha: string) {
        try {
            const pfxBuffer = Buffer.from(pfxBase64, 'base64');
            const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
            const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);
            
            const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
            // @ts-ignore
            const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
            
            const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
            // @ts-ignore
            let key = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
            if (!key) {
                const keyBags2 = p12.getBags({ bagType: forge.pki.oids.keyBag });
                // @ts-ignore
                key = keyBags2[forge.pki.oids.keyBag]?.[0]?.key;
            }

            if (!cert || !key) throw new Error("Chaves não encontradas no PFX.");

            return {
                cert: forge.pki.certificateToPem(cert),
                key: forge.pki.privateKeyToPem(key)
            };
        } catch (e: any) {
            throw new Error(`Erro ao extrair credenciais (PDF): ${e.message}`);
        }
    }

    async downloadPdfOficial(chaveAcesso: string, pfxBase64: string, senhaCertificado: string): Promise<Buffer> {
        console.log(`[BOT] Iniciando download oficial para chave: ${chaveAcesso}`);

        // 1. Descriptografia
        const pfxReal = decrypt(pfxBase64) || pfxBase64; 
        const senhaReal = decrypt(senhaCertificado) || senhaCertificado;

        if(!pfxReal || !senhaReal) throw new Error("Credenciais inválidas ou corrompidas.");

        // 2. Extração
        const credenciais = this.extrairCredenciaisLocal(pfxReal, senhaReal);

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
                    // CORREÇÃO: Converter string PEM para Buffer
                    cert: Buffer.from(credenciais.cert),
                    key: Buffer.from(credenciais.key)
                }]
            });

            const page = await context.newPage();

            // --- ETAPA 1: LOGIN ---
            console.log("[BOT] 1. Acessando página de Login...");
            await page.goto(URL_LOGIN, { timeout: 60000 });
            
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