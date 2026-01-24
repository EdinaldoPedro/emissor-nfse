import { ICanonicalRps } from '../interfaces/ICanonicalRps';

export class NacionalAdapter {
    
    private clean(str: string | undefined): string {
        return str ? str.replace(/\D/g, '') : '';
    }

    private mapRegime(regime: string): string {
        switch(regime) {
            case 'MEI': return '4';
            case 'SIMPLES': return '1'; 
            case 'LUCRO_PRESUMIDO': 
            case 'LUCRO_REAL': return '3';
            default: return '3';
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
        const s = rps.servico;
        const m = rps.meta;
        const r = s.retencoes;

        const dhEmi = this.formatData(m.dataEmissao);
        const dCompet = dhEmi.split('T')[0];
        const idDps = `DPS${this.clean(p.endereco.codigoIbge).padStart(7,'0')}2${this.clean(p.documento).padStart(14,'0')}${this.clean(m.serie).padStart(5,'0')}${String(m.numero).padStart(15,'0')}`;
        
        const tpAmb = m.ambiente === 'PRODUCAO' ? '1' : '2';
        const opSimpNac = this.mapRegime(p.regimeTributario);
        
        // TRIBUTAÇÃO MUNICIPAL
        let tribXml = `<tribMun>`;
        tribXml += `<tribISSQN>${s.tipoTributacao}</tribISSQN>`;
        tribXml += `<tpRetISSQN>${s.issRetido ? 2 : 1}</tpRetISSQN>`;
        if (s.aliquotaAplicada && s.aliquotaAplicada > 0) {
            tribXml += `<pAliq>${s.aliquotaAplicada.toFixed(2)}</pAliq>`;
        }
        if (s.valorIss && s.valorIss > 0) {
            tribXml += `<vISSQN>${s.valorIss.toFixed(2)}</vISSQN>`;
        }
        tribXml += `</tribMun>`;

        // VALORES FEDERAIS (Se houver retenção > 0)
        let valoresFederais = '';
        if (r.pis.retido && r.pis.valor > 0) valoresFederais += `<vPIS>${r.pis.valor.toFixed(2)}</vPIS>`;
        if (r.cofins.retido && r.cofins.valor > 0) valoresFederais += `<vCOFINS>${r.cofins.valor.toFixed(2)}</vCOFINS>`;
        if (r.inss.retido && r.inss.valor > 0) valoresFederais += `<vINSS>${r.inss.valor.toFixed(2)}</vINSS>`;
        if (r.ir.retido && r.ir.valor > 0) valoresFederais += `<vIR>${r.ir.valor.toFixed(2)}</vIR>`;
        if (r.csll.retido && r.csll.valor > 0) valoresFederais += `<vCSLL>${r.csll.valor.toFixed(2)}</vCSLL>`;

        return `<?xml version="1.0" encoding="UTF-8"?>` + 
        `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">` + 
            `<infDPS Id="${idDps}">` + 
                `<tpAmb>${tpAmb}</tpAmb>` + 
                `<dhEmi>${dhEmi}</dhEmi>` + 
                `<verAplic>1.00</verAplic>` + 
                `<serie>${m.serie}</serie>` + 
                `<nDPS>${m.numero}</nDPS>` + 
                `<dCompet>${dCompet}</dCompet>` + 
                `<tpEmit>1</tpEmit>` + 
                `<cLocEmi>${this.clean(p.endereco.codigoIbge)}</cLocEmi>` + 
                `<prest>` + 
                    `<CNPJ>${this.clean(p.documento)}</CNPJ>` + 
                    `<regTrib>` +
                        `<opSimpNac>${opSimpNac}</opSimpNac>` +
                        `<regEspTrib>${p.configuracoes.regimeEspecial || '0'}</regEspTrib>` +
                    `</regTrib>` + 
                `</prest>` + 
                `<toma>` + 
                    `<CNPJ>${this.clean(t.documento)}</CNPJ>` + 
                    `<xNome>${t.razaoSocial}</xNome>` + 
                    `<end><endNac><cMun>${this.clean(t.endereco.codigoIbge)}</cMun><CEP>${this.clean(t.endereco.cep)}</CEP></endNac><xLgr>${t.endereco.logradouro}</xLgr><nro>${t.endereco.numero}</nro><xBairro>${t.endereco.bairro}</xBairro></end>` + 
                    (t.email ? `<email>${t.email}</email>` : '') + 
                    (t.telefone ? `<fone>${this.clean(t.telefone)}</fone>` : '') + 
                `</toma>` + 
                `<serv>` + 
                    `<locPrest><cLocPrestacao>${this.clean(p.endereco.codigoIbge)}</cLocPrestacao></locPrest>` + 
                    `<cServ><cTribNac>${this.clean(s.codigoTributacaoNacional)}</cTribNac><xDescServ>${s.descricao}</xDescServ></cServ>` + 
                `</serv>` + 
                `<valores>` +
                    `<vServPrest><vServ>${s.valor.toFixed(2)}</vServ></vServPrest>` +
                    `<trib>${tribXml}</trib>` +
                    valoresFederais + 
                    `<vLiq>${s.valorLiquido.toFixed(2)}</vLiq>` + 
                `</valores>` + 
            `</infDPS>` + 
        `</DPS>`;
    }
}