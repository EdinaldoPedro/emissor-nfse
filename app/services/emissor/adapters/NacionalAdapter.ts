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
            case 'SIMPLES': return '3';
            case 'LUCRO_PRESUMIDO': 
            case 'LUCRO_REAL': return '1';
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

    // === DICIONÁRIOS PARA EXPORTAÇÃO ===
    private mapPais(pais: string): string {
        const dict: Record<string, string> = {
            "África do Sul": "ZA", "Alemanha": "DE", "Angola": "AO", "Arábia Saudita": "SA", 
            "Argentina": "AR", "Austrália": "AU", "Áustria": "AT", "Bélgica": "BE", "Bolívia": "BO", 
            "Brasil": "BR", "Canadá": "CA", "Chile": "CL", "China": "CN", "Cingapura": "SG", 
            "Colômbia": "CO", "Coreia do Sul": "KR", "Costa Rica": "CR", "Croácia": "HR", 
            "Dinamarca": "DK", "Egito": "EG", "Emirados Árabes Unidos": "AE", "Equador": "EC", 
            "Espanha": "ES", "Estados Unidos": "US", "Finlândia": "FI", "França": "FR", 
            "Grécia": "GR", "Holanda": "NL", "Hong Kong": "HK", "Índia": "IN", "Indonésia": "ID", 
            "Irlanda": "IE", "Israel": "IL", "Itália": "IT", "Japão": "JP", "México": "MX", 
            "Noruega": "NO", "Nova Zelândia": "NZ", "Panamá": "PA", "Paraguai": "PY", "Peru": "PE", 
            "Polônia": "PL", "Portugal": "PT", "Reino Unido": "GB", "Rússia": "RU", "Suécia": "SE", 
            "Suíça": "CH", "Tailândia": "TH", "Turquia": "TR", "Uruguai": "UY", "Venezuela": "VE"
        };
        return dict[pais] || "US"; // Fallback para US se não achar
    }

    private mapMoeda(moeda: string): string {
        const dict: Record<string, string> = {
            "BRL": "986", "USD": "840", "EUR": "978", "GBP": "826", "ARS": "032"
        };
        return dict[moeda] || "840";
    }

    public toXml(rps: ICanonicalRps): string {
        const p = rps.prestador;
        const t = rps.tomador;
        const s = rps.servico as any;
        const m = rps.meta;
        
        const r = s.retencoes || { pis: {}, cofins: {}, inss: {}, ir: {}, csll: {} };

        const dhEmi = this.formatData(m.dataEmissao);
        const dCompet = dhEmi.split('T')[0];
        const idDps = `DPS${this.clean(p.endereco.codigoIbge).padStart(7,'0')}2${this.clean(p.documento).padStart(14,'0')}${this.clean(m.serie).padStart(5,'0')}${String(m.numero).padStart(15,'0')}`;
        
        const tpAmb = m.ambiente === 'PRODUCAO' ? '1' : '2';
        const opSimpNac = this.mapRegime(p.regimeTributario);
        
        // --- LÓGICA DE EXPORTAÇÃO ---
        const isExterior = t.tipo === 'EXT' || (t.pais && t.pais !== 'Brasil' && t.pais !== 'BR');
        const codPais = this.mapPais(t.pais || 'Estados Unidos');
        const codMoeda = this.mapMoeda(t.moeda || 'USD');

        const docTomador = this.clean(t.documento);
        const tagDocTomador = docTomador.length === 11 ? `<CPF>${docTomador}</CPF>` : `<CNPJ>${docTomador}</CNPJ>`;

        // Regras Tributárias
        let regTribXml = `<opSimpNac>${opSimpNac}</opSimpNac>`;
        if (opSimpNac === '3') regTribXml += `<regApTribSN>1</regApTribSN>`;
        regTribXml += `<regEspTrib>${p.configuracoes?.regimeEspecial || '0'}</regEspTrib>`;

        let tribXml = `<tribMun>`;
        tribXml += `<tribISSQN>${s.tipoTributacao || (isExterior ? '4' : '1')}</tribISSQN>`; // 4 = Exportação (Isento)
        tribXml += `<tpRetISSQN>${s.issRetido ? '2' : '1'}</tpRetISSQN>`;
        if (s.aliquotaAplicada && s.aliquotaAplicada > 0 && !isExterior) tribXml += `<pAliq>${s.aliquotaAplicada.toFixed(2)}</pAliq>`;
        if (s.valorIss && s.valorIss > 0 && !isExterior) tribXml += `<vISSQN>${s.valorIss.toFixed(2)}</vISSQN>`;
        tribXml += `</tribMun>`;
        
        if (opSimpNac === '3') {
            const aliquotaSN = (s.aliquotaAplicada && s.aliquotaAplicada > 0) ? s.aliquotaAplicada.toFixed(2) : '6.00';
            tribXml += `<totTrib><pTotTribSN>${aliquotaSN}</pTotTribSN></totTrib>`;
        } else {
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

        // Montagem do XML <toma>
        let tomaXml = `<toma>`;
        if (isExterior) {
            if (t.nif) tomaXml += `<NIF>${this.escapeXml(t.nif)}</NIF>`;
            else tomaXml += `<cNaoNIF>2</cNaoNIF>`;
        } else {
            tomaXml += tagDocTomador;
        }
        tomaXml += `<xNome>${razaoSocialTomador}</xNome>`;
        tomaXml += `<end>`;
        if (isExterior) {
            tomaXml += `<endExt>` +
                       `<cPais>${codPais}</cPais>` +
                       `<cEndPost>${this.escapeXml(this.clean(t.endereco.cep) || '00000')}</cEndPost>` +
                       `<xCidade>${this.escapeXml(t.endereco.cidade || 'Exterior')}</xCidade>` +
                       `<xEstProvReg>${this.escapeXml(t.endereco.uf || 'EX')}</xEstProvReg>` +
                       `</endExt>`;
        } else {
            tomaXml += `<endNac><cMun>${this.clean(t.endereco.codigoIbge)}</cMun><CEP>${this.clean(t.endereco.cep)}</CEP></endNac>`;
        }
        tomaXml += `<xLgr>${enderecoLogradouro}</xLgr>` +
                   `<nro>${this.escapeXml(t.endereco.numero) || 'SN'}</nro>`;
        if (enderecoBairro) tomaXml += `<xBairro>${enderecoBairro}</xBairro>`;
        tomaXml += `</end>`;
        if (t.email) tomaXml += `<email>${t.email}</email>`;
        if (t.telefone) tomaXml += `<fone>${this.clean(t.telefone)}</fone>`;
        tomaXml += `</toma>`;

        // Montagem do XML <serv>
        let locPrestXml = isExterior 
            ? `<locPrest><cPaisPrestacao>${codPais}</cPaisPrestacao></locPrest>` 
            : `<locPrest><cLocPrestacao>${this.clean(p.endereco.codigoIbge)}</cLocPrestacao></locPrest>`;

        let servXml = `<serv>` + locPrestXml + `<cServ>` +
                      `<cTribNac>${this.clean(s.codigoTributacaoNacional)}</cTribNac>`;
        if (s.codigoTributacaoMunicipal) servXml += `<cTribMun>${this.clean(s.codigoTributacaoMunicipal)}</cTribMun>`;
        servXml += `<xDescServ>${descricaoServico}</xDescServ>`;
        
        // NBS Obrigatório para exterior
        if (isExterior) {
            const nbs = s.codigoNbs ? this.clean(s.codigoNbs) : '000000000';
            servXml += `<cNBS>${nbs}</cNBS>`;
        }
        servXml += `</cServ>`;

        // Bloco comExt
        if (isExterior && s.valorMoedaEstrangeira) {
            servXml += `<comExt>` +
                       `<mdPrestacao>4</mdPrestacao>` +
                       `<vincPrest>0</vincPrest>` +
                       `<tpMoeda>${codMoeda}</tpMoeda>` +
                       `<vServMoeda>${Number(s.valorMoedaEstrangeira).toFixed(2)}</vServMoeda>` +
                       `<mecAFComexP>01</mecAFComexP>` +
                       `<mecAFComexT>01</mecAFComexT>` +
                       `<movTempBens>1</movTempBens>` +
                       `<mdic>0</mdic>` +
                       `</comExt>`;
        }
        servXml += `</serv>`;

        // FINAL XML
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
                tomaXml + 
                servXml + 
                `<valores>` +
                    `<vServPrest><vServ>${s.valor.toFixed(2)}</vServ></vServPrest>` +
                    `<trib>${tribXml}</trib>` +
                    valoresFederais;

        const temRetencao = s.issRetido || valoresFederais !== '';
        if (temRetencao || (p.regimeTributario !== 'MEI' && p.regimeTributario !== 'SIMPLES')) {
            xml += `<vLiq>${Number(vLiqFinal).toFixed(2)}</vLiq>`;
        }

        xml += `</valores>` + `</infDPS>` + `</DPS>`;

        return xml;
    }
}