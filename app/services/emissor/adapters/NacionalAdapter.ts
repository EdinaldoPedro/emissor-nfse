import { ICanonicalRps } from '../interfaces/ICanonicalRps';

export class NacionalAdapter {
    
    private clean(str: string | undefined): string {
        return str ? str.replace(/\D/g, '') : '';
    }
    
    private escapeXml(unsafe: string | undefined): string {
        if (!unsafe) return '';
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }

    private mapRegime(regime: string): string {
        switch(regime) {
            case 'MEI': return '2'; 
            case 'SIMPLES': return '3'; // 3 = Optante ME/EPP
            case 'LUCRO_PRESUMIDO': 
            case 'LUCRO_REAL': return '1'; // 1 = Não Optante
            default: return '1';
        }
    }

    private formatData(date: Date): string {
        const timestamp = date.getTime();
        const offsetBrasilia = -3 * 60 * 60 * 1000;
        const dateBR = new Date(timestamp + offsetBrasilia);
        
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${dateBR.getUTCFullYear()}-${pad(dateBR.getUTCMonth() + 1)}-${pad(dateBR.getUTCDate())}T${pad(dateBR.getUTCHours())}:${pad(dateBR.getUTCMinutes())}:${pad(dateBR.getUTCSeconds())}-03:00`;
    }

    public toXml(rps: ICanonicalRps): string {
        const p = rps.prestador;
        const t = rps.tomador;
        const s = rps.servico as any;
        const m = rps.meta;
        
        const r = s.retencoes || { 
            pis: { valor: 0, retido: false },
            cofins: { valor: 0, retido: false },
            inss: { valor: 0, retido: false },
            ir: { valor: 0, retido: false },
            csll: { valor: 0, retido: false }
        };

        const dhEmi = this.formatData(m.dataEmissao);
        const dCompet = dhEmi.split('T')[0];
        const idDps = `DPS${this.clean(p.endereco.codigoIbge).padStart(7,'0')}2${this.clean(p.documento).padStart(14,'0')}${this.clean(m.serie).padStart(5,'0')}${String(m.numero).padStart(15,'0')}`;
        
        const tpAmb = m.ambiente === 'PRODUCAO' ? '1' : '2';
        const opSimpNac = this.mapRegime(p.regimeTributario);
        
        const docTomador = this.clean(t.documento);
        const tagDocTomador = docTomador.length === 11 
            ? `<CPF>${docTomador}</CPF>` 
            : `<CNPJ>${docTomador}</CNPJ>`;

        let regTribXml = `<opSimpNac>${opSimpNac}</opSimpNac>`;
        if (opSimpNac === '3') {
            regTribXml += `<regApTribSN>1</regApTribSN>`;
        }
        regTribXml += `<regEspTrib>${p.configuracoes?.regimeEspecial || '0'}</regEspTrib>`;

        let tribXml = `<tribMun>`;
        tribXml += `<tribISSQN>${s.tipoTributacao || '1'}</tribISSQN>`;
        tribXml += `<tpRetISSQN>${s.issRetido ? '2' : '1'}</tpRetISSQN>`;
        
        if (s.aliquotaAplicada && s.aliquotaAplicada > 0) {
            tribXml += `<pAliq>${s.aliquotaAplicada.toFixed(2)}</pAliq>`;
        }
        if (s.valorIss && s.valorIss > 0) {
            tribXml += `<vISSQN>${s.valorIss.toFixed(2)}</vISSQN>`;
        }
        tribXml += `</tribMun>`;
        
        // ==========================================
        // CORREÇÃO APLICADA AQUI: Tratamento do totTrib
        // ==========================================
        if (opSimpNac === '3') {
            // Para Simples Nacional: Envia o percentual de tributos
            const aliquotaSN = (s.aliquotaAplicada && s.aliquotaAplicada > 0) ? s.aliquotaAplicada.toFixed(2) : '6.00';
            tribXml += `<totTrib><pTotTribSN>${aliquotaSN}</pTotTribSN></totTrib>`;
        } else {
            // Para MEI (2) e Lucro Presumido/Real (1): O Schema exige o indTotTrib
            tribXml += `<totTrib><indTotTrib>0</indTotTrib></totTrib>`;
        }

        let valoresFederais = '';
        if (r.pis?.retido && (r.pis.valor || 0) > 0) valoresFederais += `<vPIS>${Number(r.pis.valor).toFixed(2)}</vPIS>`;
        if (r.cofins?.retido && (r.cofins.valor || 0) > 0) valoresFederais += `<vCOFINS>${Number(r.cofins.valor).toFixed(2)}</vCOFINS>`;
        if (r.inss?.retido && (r.inss.valor || 0) > 0) valoresFederais += `<vINSS>${Number(r.inss.valor).toFixed(2)}</vINSS>`;
        if (r.ir?.retido && (r.ir.valor || 0) > 0) valoresFederais += `<vIR>${Number(r.ir.valor).toFixed(2)}</vIR>`;
        if (r.csll?.retido && (r.csll.valor || 0) > 0) valoresFederais += `<vCSLL>${Number(r.csll.valor).toFixed(2)}</vCSLL>`;

        const vLiqFinal = (s.valorLiquido !== undefined && s.valorLiquido !== null) ? s.valorLiquido : s.valor;

        const razaoSocialTomador = this.escapeXml(t.razaoSocial);
        const enderecoLogradouro = this.escapeXml(t.endereco.logradouro);
        const enderecoBairro = this.escapeXml(t.endereco.bairro);
        const descricaoServico = this.escapeXml(s.descricao);

        let xml = `<?xml version="1.0" encoding="UTF-8"?>` + 
        `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">` + 
            `<infDPS Id="${idDps}">` + 
                `<tpAmb>${tpAmb}</tpAmb>` + 
                `<dhEmi>${dhEmi}</dhEmi>` + 
                `<verAplic>1.10</verAplic>` + 
                `<serie>${m.serie}</serie>` + 
                `<nDPS>${m.numero}</nDPS>` + 
                `<dCompet>${dCompet}</dCompet>` + 
                `<tpEmit>1</tpEmit>` + 
                `<cLocEmi>${this.clean(p.endereco.codigoIbge)}</cLocEmi>` + 
                `<prest>` + 
                    `<CNPJ>${this.clean(p.documento)}</CNPJ>` + 
                    (p.inscricaoMunicipal ? `<IM>${this.clean(p.inscricaoMunicipal)}</IM>` : '') + 
                    `<regTrib>${regTribXml}</regTrib>` + 
                `</prest>` + 
                `<toma>` + 
                    tagDocTomador + 
                    `<xNome>${razaoSocialTomador}</xNome>` + 
                    `<end>` +
                        `<endNac><cMun>${this.clean(t.endereco.codigoIbge)}</cMun><CEP>${this.clean(t.endereco.cep)}</CEP></endNac>` +
                        `<xLgr>${enderecoLogradouro}</xLgr>` +
                        `<nro>${t.endereco.numero}</nro>` +
                        `<xBairro>${enderecoBairro}</xBairro>` +
                    `</end>` + 
                    (t.email ? `<email>${t.email}</email>` : '') + 
                    (t.telefone ? `<fone>${this.clean(t.telefone)}</fone>` : '') + 
                `</toma>` + 
                `<serv>` + 
                    `<locPrest><cLocPrestacao>${this.clean(p.endereco.codigoIbge)}</cLocPrestacao></locPrest>` + 
                    `<cServ>` + 
                        `<cTribNac>${this.clean(s.codigoTributacaoNacional)}</cTribNac>` +
                        (s.codigoTributacaoMunicipal ? `<cTribMun>${this.clean(s.codigoTributacaoMunicipal)}</cTribMun>` : '') + 
                        `<xDescServ>${descricaoServico}</xDescServ>` + 
                    `</cServ>` + 
                `</serv>` + 
                `<valores>` +
                    `<vServPrest><vServ>${s.valor.toFixed(2)}</vServ></vServPrest>` +
                    `<trib>${tribXml}</trib>` +
                    valoresFederais;

        const temRetencao = s.issRetido || valoresFederais !== '';
        if (temRetencao || (p.regimeTributario !== 'MEI' && p.regimeTributario !== 'SIMPLES')) {
            xml += `<vLiq>${Number(vLiqFinal).toFixed(2)}</vLiq>`;
        }

        xml += `</valores>` + 
            `</infDPS>` + 
        `</DPS>`;

        return xml;
    }
}