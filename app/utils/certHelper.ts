import forge from 'node-forge';

export function extractCertAndKeyFromPfx(pfxBase64: string, password: string) {
    try {
        const pfxBuffer = Buffer.from(pfxBase64, 'base64');
        const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

        // 1. Extrair Certificado (PEM)
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        // @ts-ignore
        const certBag = certBags[forge.pki.oids.certBag]?.[0];
        
        // CORREÇÃO: Verifica se certBag OU certBag.cert são nulos/indefinidos
        if (!certBag || !certBag.cert) throw new Error("Certificado não encontrado no PFX");
        
        const certPem = forge.pki.certificateToPem(certBag.cert);

        // 2. Extrair Chave Privada (KEY)
        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        // @ts-ignore
        let keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
        
        // Fallback se a chave não estiver protegida (shrouded)
        if (!keyBag) {
            const keyBags2 = p12.getBags({ bagType: forge.pki.oids.keyBag });
            // @ts-ignore
            keyBag = keyBags2[forge.pki.oids.keyBag]?.[0];
        }

        // CORREÇÃO: Verifica se keyBag OU keyBag.key são nulos/indefinidos
        if (!keyBag || !keyBag.key) throw new Error("Chave privada não encontrada no PFX");

        const keyPem = forge.pki.privateKeyToPem(keyBag.key);

        return {
            cert: Buffer.from(certPem),
            key: Buffer.from(keyPem)
        };

    } catch (e: any) {
        throw new Error(`Falha ao processar certificado: ${e.message}`);
    }
}