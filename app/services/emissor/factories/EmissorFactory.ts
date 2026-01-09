import { IEmissorStrategy } from '../interfaces/IEmissorStrategy';
import { MeiRecifeStrategy } from '../strategies/mei/MeiRecifeStrategy';

export class EmissorFactory {
    static getStrategy(empresa: any): IEmissorStrategy {
        
        const regime = empresa.regimeTributario || 'MEI';
        // Remove caracteres não numéricos do IBGE para comparar
        const ibge = empresa.codigoIbge ? empresa.codigoIbge.replace(/\D/g, '') : '';

        // REGRA: MEI em Recife (2611606)
        if (regime === 'MEI' && ibge === '2611606') {
            console.log(`[FACTORY] Selecionada estratégia: MEI / Recife-PE`);
            return new MeiRecifeStrategy();
        }

        // Futuro: Adicionar outros ifs aqui (ex: Simples Nacional, São Paulo, etc)
        // if (regime === 'SIMPLES') return new SimplesStrategy();

        // Default (Por enquanto usaremos o MEI Recife como fallback ou lançamos erro)
        // Para evitar travamento, vamos usar o MEI Recife como padrão temporário
        console.log(`[FACTORY] Fallback: Usando estratégia MEI/Recife`);
        return new MeiRecifeStrategy(); 
    }
}