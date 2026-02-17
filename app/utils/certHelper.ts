import forge from 'node-forge';

export function extrairCredenciais(pfxBase64: string, senha: string) {
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
        throw new Error(`Erro ao extrair credenciais: ${e.message}`);
    }
}