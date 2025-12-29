import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { syncCnaesGlobalmente } from '@/app/services/syncService'; 
import forge from 'node-forge';

const prisma = new PrismaClient();

// GET
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { empresa: { include: { atividades: true } } }
  });

  if (!user) return NextResponse.json({ error: 'User não encontrado' }, { status: 404 });

  const empresa = user.empresa || {};
  // @ts-ignore
  const { certificadoA1, senhaCertificado, email: emailEmpresa, ...rest } = empresa;

  return NextResponse.json({
    ...rest,
    emailComercial: emailEmpresa,
    
    temCertificado: !!certificadoA1,
    vencimentoCertificado: empresa.certificadoVencimento,
    cadastroCompleto: empresa.cadastroCompleto || false,
    role: user.role,

    nome: user.nome,
    email: user.email,
    cpf: user.cpf,
    telefone: user.telefone,
    atividades: empresa.atividades || []
  });
}

// PUT
export async function PUT(request: Request) {
  const userId = request.headers.get('x-user-id');
  const body = await request.json();

  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ 
        where: { id: userId },
        include: { empresa: true }
    });

    const isAdmin = ['ADMIN', 'MASTER', 'SUPORTE'].includes(user?.role || '');
    const empresaExistente = user?.empresa;

    // === LÓGICA DE TRAVAMENTO INTELIGENTE ===
    // Se o cadastro está completo e não é admin, VERIFICAMOS O QUE ESTÁ MUDANDO.
    if (empresaExistente?.cadastroCompleto && !isAdmin) {
        const cnpjAtual = empresaExistente.documento;
        const cnpjNovo = body.documento.replace(/\D/g, '');

        // Se tentar trocar o CNPJ, bloqueia.
        if (cnpjAtual !== cnpjNovo) {
            return NextResponse.json({ 
                error: 'O CNPJ está vinculado e não pode ser alterado. Contate o suporte.' 
            }, { status: 403 });
        }
        // Se o CNPJ for o mesmo, permite seguir (para atualizar endereço ou certificado).
    }

    // 1. Atualiza User
    await prisma.user.update({
      where: { id: userId },
      data: { nome: body.nome, telefone: body.telefone }
    });

    // 2. Atualiza Empresa
    if (body.documento) {
      const cnpjLimpo = body.documento.replace(/\D/g, '');
      
      const dadosEmpresa: any = {
          razaoSocial: body.razaoSocial,
          nomeFantasia: body.nomeFantasia,
          inscricaoMunicipal: body.inscricaoMunicipal,
          regimeTributario: body.regimeTributario,
          cep: body.cep,
          logradouro: body.logradouro,
          numero: body.numero,
          bairro: body.bairro,
          cidade: body.cidade,
          uf: body.uf,
          codigoIbge: body.codigoIbge,
          email: body.emailComercial || body.email,
          cadastroCompleto: true // Garante que continue travado/completo
      };

      // --- TRATAMENTO DO CERTIFICADO ---
      if (body.deletarCertificado) {
          dadosEmpresa.certificadoA1 = null;
          dadosEmpresa.senhaCertificado = null;
          dadosEmpresa.certificadoVencimento = null;
          // Se deletar, podemos destravar para permitir troca de CNPJ se quiser? 
          // Por segurança, mantemos travado o CNPJ, mas o certificado fica null.
      } 
      else if (body.certificadoArquivo && body.certificadoSenha) {
          try {
              const p12Der = forge.util.decode64(body.certificadoArquivo);
              const p12Asn1 = forge.asn1.fromDer(p12Der);
              const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, body.certificadoSenha);
              
              let dataVencimento = null;
              const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
              // @ts-ignore
              const certBag = bags[forge.pki.oids.certBag]?.[0];
              if(certBag && certBag.cert) dataVencimento = certBag.cert.validity.notAfter;

              dadosEmpresa.certificadoA1 = body.certificadoArquivo;
              dadosEmpresa.senhaCertificado = body.certificadoSenha;
              dadosEmpresa.certificadoVencimento = dataVencimento;
          } catch (e) {
              return NextResponse.json({ error: 'Senha incorreta ou arquivo inválido.' }, { status: 400 });
          }
      }

      const empresaSalva = await prisma.empresa.upsert({
          where: { documento: cnpjLimpo },
          update: dadosEmpresa,
          create: { documento: cnpjLimpo, ...dadosEmpresa }
      });

      // Garante Vínculo
      if (user?.empresaId !== empresaSalva.id) {
          const donoAtual = await prisma.user.findFirst({ where: { empresaId: empresaSalva.id } });
          if (donoAtual && donoAtual.id !== userId && !isAdmin) {
              return NextResponse.json({ error: 'CNPJ já pertence a outro usuário.' }, { status: 409 });
          }
          await prisma.user.update({ where: { id: userId }, data: { empresaId: empresaSalva.id } });
      }

      // CNAEs
      if (body.cnaes && Array.isArray(body.cnaes)) {
          await prisma.cnae.deleteMany({ where: { empresaId: empresaSalva.id } });
          if (body.cnaes.length > 0) {
              await prisma.cnae.createMany({
                  data: body.cnaes.map((c: any) => ({
                      empresaId: empresaSalva.id,
                      codigo: String(c.codigo).replace(/\D/g, ''),
                      descricao: c.descricao,
                      principal: c.principal
                  }))
              });
              await syncCnaesGlobalmente(body.cnaes, empresaSalva.codigoIbge);
          }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}