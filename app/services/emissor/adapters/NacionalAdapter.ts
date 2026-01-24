// app/services/emissor/adapters/NacionalAdapter.ts

import { ICanonicalRps } from '../interfaces/ICanonicalRps';

export class NacionalAdapter {
    
    private clean(str: string | undefined): string {
        return str ? str.replace(/\D/g, '') : '';
    }

    // Converte nosso Regime Interno para o Código do Portal Nacional
    private mapRegime(regime: string): string {
        switch(regime) {
            case 'MEI': return '4';
            case 'SIMPLES': return '1'; // Ou 2 se tiver excesso
            case 'LUCRO_PRESUMIDO': 
            case 'LUCRO_REAL': return '3';
            default: return '3';
        }
    }

    private formatData(date: Date): string {
        // Formato: AAAA-MM-DDThh:mm:ss-03:00
        const timestamp = date.getTime();
        const offsetBrasilia = -3 * 60 * 60 * 1000;
        const dateBR = new Date(timestamp + offsetBrasilia);
        
        const pad = (n: number) => n.toString().padStart(2, '0');
        const YYYY = dateBR.getUTCFullYear();
        const MM = pad(dateBR.getUTCMonth() + 1);
        const DD = pad(dateBR.getUTCDate());
        const HH = pad(dateBR.getUTCHours());
        const mm = pad(dateBR.getUTCMinutes());
        const ss = pad(dateBR.getUTCSeconds());
        
        return `${YYYY}-${MM}-${DD}T${HH}:${mm}:${ss}-03:00`;
    }

    public toXml(rps: ICanonicalRps): string {
        const p = rps.prestador;
        const t = rps.tomador;
        const s = rps.servico;
        const m = rps.meta;

        const dhEmi = this.formatData(m.dataEmissao);
        const dCompet = dhEmi.split('T')[0];
        
        // Identificador Único do DPS
        const idDps = `DPS${this.clean(p.endereco.codigoIbge).padStart(7,'0')}2${this.clean(p.documento).padStart(14,'0')}${this.clean(m.serie).padStart(5,'0')}${String(m.numero).padStart(15,'0')}`;
        
        const tpAmb = m.ambiente === 'PRODUCAO' ? '1' : '2';
        const opSimpNac = this.mapRegime(p.regimeTributario);
        
        // Bloco de Tributação (Dinâmico)
        let tribXml = `<tribMun>`;
        tribXml += `<tribISSQN>${s.tipoTributacao}</tribISSQN>`; // 1=Exigivel
        tribXml += `<tpRetISSQN>${s.issRetido ? 2 : 1}</tpRetISSQN>`;
        
        // Só adiciona alíquota se for maior que 0 e regime permitir
        if (s.aliquotaAplicada && s.aliquotaAplicada > 0) {
            tribXml += `<pAliq>${s.aliquotaAplicada.toFixed(2)}</pAliq>`;
        }
        if (s.valorIss && s.valorIss > 0) {
            tribXml += `<vISSQN>${s.valorIss.toFixed(2)}</vISSQN>`;
        }
        tribXml += `</tribMun>`;

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
                `</valores>` + 
            `</infDPS>` + 
        `</DPS>`;
    }
}