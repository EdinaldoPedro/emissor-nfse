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

    private mapPais(pais: string): string {
        const dict: Record<string, string> = {
            "África do Sul": "ZA", "Alemanha": "DE", "Angola": "AO", "Argentina": "AR", "Austrália": "AU", 
            "Brasil": "BR", "Canadá": "CA", "Chile": "CL", "China": "CN", "Colômbia": "CO", 
            "Espanha": "ES", "Estados Unidos": "US", "França": "FR", "Itália": "IT", "Japão": "JP", 
            "México": "MX", "Paraguai": "PY", "Peru": "PE", "Portugal": "PT", "Reino Unido": "GB", "Uruguai": "UY"
        };
        return dict[pais] || "US";
    }

    private mapMoeda(moeda: string): string {
        const dict: Record<string, string> = { "BRL": "986", "USD": "840", "EUR": "978", "GBP": "826", "ARS": "032" };
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
        
        const isExterior = t.tipo === 'EXT' || (t.pais && t.pais !== 'Brasil' && t.pais !== 'BR');
        const codPais = this.mapPais(t.pais || 'Estados Unidos');
        const codMoeda = this.mapMoeda(t.moeda || 'USD');

        const docTomador = this.clean(t.documento);
        const tagDocTomador = docTomador.length === 11 ? `<CPF>${docTomador}</CPF>` : `<CNPJ>${docTomador}</CNPJ>`;

        const razaoSocialTomador = this.escapeXml(t.razaoSocial);
        const enderecoLogradouro = this.escapeXml(t.endereco.logradouro);
        const enderecoBairro = this.escapeXml(t.endereco.bairro);
        const descricaoServico = this.escapeXml(s.descricao);

        // --- PRESTADOR ---
        let prestXml = `<prest>` + 
            `<CNPJ>${this.clean(p.documento)}</CNPJ>` + 
            (p.inscricaoMunicipal ? `<IM>${this.clean(p.inscricaoMunicipal)}</IM>` : '');
        
        // Dados de contato do Prestador (Requisito Sefin)
        if (p.telefone) prestXml += `<fone>${this.clean(p.telefone)}</fone>`;
        if (p.email) prestXml += `<email>${p.email}</email>`;
        
        prestXml += `<regTrib><opSimpNac>${opSimpNac}</opSimpNac>`;
        if (opSimpNac === '3') prestXml += `<regApTribSN>1</regApTribSN>`;
        prestXml += `<regEspTrib>${p.configuracoes?.regimeEspecial || '0'}</regEspTrib></regTrib></prest>`;

        // --- TOMADOR ---
        let tomaXml = `<toma>`;
        if (isExterior) {
            if (t.nif) tomaXml += `<NIF>${this.escapeXml(t.nif)}</NIF>`;
            else tomaXml += `<cNaoNIF>2</cNaoNIF>`;
        } else {
            tomaXml += tagDocTomador;
        }
        tomaXml += `<xNome>${razaoSocialTomador}</xNome><end>`;
        
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
        // Add xCpl se existir
        if (t.endereco.complemento) tomaXml += `<xCpl>${this.escapeXml(t.endereco.complemento)}</xCpl>`;
        if (enderecoBairro) tomaXml += `<xBairro>${enderecoBairro}</xBairro>`;
        tomaXml += `</end>`;
        if (t.email) tomaXml += `<email>${t.email}</email>`;
        if (t.telefone) tomaXml += `<fone>${this.clean(t.telefone)}</fone>`;
        tomaXml += `</toma>`;

        // --- SERVIÇO ---
        let locPrestXml = isExterior 
            ? `<locPrest><cPaisPrestacao>${codPais}</cPaisPrestacao></locPrest>` 
            : `<locPrest><cLocPrestacao>${this.clean(p.endereco.codigoIbge)}</cLocPrestacao></locPrest>`;

        let servXml = `<serv>` + locPrestXml + `<cServ>` +
                      `<cTribNac>${this.clean(s.codigoTributacaoNacional)}</cTribNac>`;
        
        // === O "LEÃO DE CHÁCARA" ENTRA EM AÇÃO AQUI ===
        // Limpa a variável primeiro. Só desenha a tag se sobrar algum número de verdade.
        const codTribMunLimpo = this.clean(s.codigoTributacaoMunicipal);
        if (codTribMunLimpo.length > 0) {
            servXml += `<cTribMun>${codTribMunLimpo}</cTribMun>`;
        }
        
        servXml += `<xDescServ>${descricaoServico}</xDescServ>`;
        
        const nbs = s.codigoNbs ? this.clean(s.codigoNbs) : '000000000';
        servXml += `<cNBS>${nbs}</cNBS></cServ>`;

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

        // --- TRIBUTOS (A MÁGICA DO LUCRO PRESUMIDO) ---
        let tribXml = `<tribMun>`;
        tribXml += `<tribISSQN>${s.tipoTributacao || (isExterior ? '4' : '1')}</tribISSQN>`;
        tribXml += `<tpRetISSQN>${s.issRetido ? '2' : '1'}</tpRetISSQN>`;
        
        // Tags pAliq e vISSQN soltas são exclusivas do Simples Nacional (opSimpNac = 3).
        // Lucro Presumido (1) NÃO leva essas tags aqui.
        if (opSimpNac === '3' && !isExterior) {
            if (s.aliquotaAplicada && s.aliquotaAplicada > 0) tribXml += `<pAliq>${s.aliquotaAplicada.toFixed(2)}</pAliq>`;
            if (s.valorIss && s.valorIss > 0) tribXml += `<vISSQN>${s.valorIss.toFixed(2)}</vISSQN>`;
        }
        tribXml += `</tribMun>`;

        // === IMPOSTOS FEDERAIS ===
        const hasPis = r.pis?.retido && (r.pis.valor || 0) > 0;
        const hasCofins = r.cofins?.retido && (r.cofins.valor || 0) > 0;
        const hasIr = r.ir?.retido && (r.ir.valor || 0) > 0;
        const hasCsll = r.csll?.retido && (r.csll.valor || 0) > 0;
        const hasInss = r.inss?.retido && (r.inss.valor || 0) > 0;

        if (opSimpNac === '1' && !isExterior && (hasPis || hasCofins || hasIr || hasCsll || hasInss)) {
            tribXml += `<tribFed>`;
            
            // Bloco PIS/COFINS
            if (hasPis || hasCofins) {
                tribXml += `<piscofins><CST>01</CST><vBCPisCofins>${s.valor.toFixed(2)}</vBCPisCofins>`;
                if (hasPis) tribXml += `<pAliqPis>${Number(r.pis.aliquota || 0.65).toFixed(2)}</pAliqPis>`;
                if (hasCofins) tribXml += `<pAliqCofins>${Number(r.cofins.aliquota || 3.00).toFixed(2)}</pAliqCofins>`;
                if (hasPis) tribXml += `<vPis>${Number(r.pis.valor).toFixed(2)}</vPis>`;
                if (hasCofins) tribXml += `<vCofins>${Number(r.cofins.valor).toFixed(2)}</vCofins>`;
                tribXml += `<tpRetPisCofins>3</tpRetPisCofins></piscofins>`; // 3 = Retido por PJ Privada
            }

            if (hasInss) tribXml += `<vRetCP>${Number(r.inss.valor).toFixed(2)}</vRetCP>`;
            if (hasIr) tribXml += `<vRetIRRF>${Number(r.ir.valor).toFixed(2)}</vRetIRRF>`;
            if (hasCsll) tribXml += `<vRetCSLL>${Number(r.csll.valor).toFixed(2)}</vRetCSLL>`;
            
            tribXml += `</tribFed>`;
        }

        // === TOTAIS DE TRIBUTOS (Transparência / IBPT) ===
        if (opSimpNac === '3') {
            // 1. REGRA DO SIMPLES NACIONAL
            const aliquotaSN = (s.aliquotaAplicada && s.aliquotaAplicada > 0) ? s.aliquotaAplicada.toFixed(2) : '6.00';
            tribXml += `<totTrib><pTotTribSN>${aliquotaSN}</pTotTribSN></totTrib>`;
            
        } else if (opSimpNac === '1') {
            // 2. REGRA DO LUCRO PRESUMIDO / LUCRO REAL
            let pFed = 0;
            // Soma APENAS PIS, COFINS e CSLL (Para cravar os 4.65%)
            if (hasPis) pFed += Number(r.pis.aliquota || 0);
            if (hasCofins) pFed += Number(r.cofins.aliquota || 0);
            if (hasCsll) pFed += Number(r.csll.aliquota || 0);

            // A tag pTotTribMun pega a alíquota da Tabela Municipal SEMPRE, retido ou não
            const pMun = s.aliquotaAplicada ? Number(s.aliquotaAplicada) : 0;

            tribXml += `<totTrib><pTotTrib><pTotTribFed>${pFed.toFixed(2)}</pTotTribFed><pTotTribEst>0.00</pTotTribEst><pTotTribMun>${pMun.toFixed(2)}</pTotTribMun></pTotTrib></totTrib>`;
            
        } else {
            // 3. REGRA DO MEI (opSimpNac === '2' ou outros)
            // MEI é isento dessa cadeia de transparência no padrão nacional
            tribXml += `<totTrib><indTotTrib>0</indTotTrib></totTrib>`;
        }

        // --- FINAL XML ---
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
                prestXml + 
                tomaXml + 
                servXml + 
                `<valores>` +
                    `<vServPrest><vServ>${s.valor.toFixed(2)}</vServ></vServPrest>` +
                    `<trib>${tribXml}</trib>` +
                `</valores>` + 
            `</infDPS>` + 
        `</DPS>`;

        return xml;
    }
}