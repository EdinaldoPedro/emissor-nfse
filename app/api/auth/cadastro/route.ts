// ... (importações e validações iguais ao anterior)

    const senhaHash = await bcrypt.hash(senha, 10);

    // TRANSAÇÃO: Cria o Usuário E o Cliente ao mesmo tempo
    await prisma.$transaction(async (tx) => {
      // 1. Cria o Login (Usuario)
      const novoUsuario = await tx.usuario.create({
        data: {
          nome,
          email,
          senha: senhaHash,
          tipo: 'CLIENTE',
        },
      });

      // 2. Cria a Ficha de Cliente (usando os mesmos dados)
      // Nota: O campo 'documento' é obrigatório no seu schema de Cliente? 
      // Se for, precisaremos pedir o CPF no formulário de cadastro.
      // Vou assumir que por enquanto vamos deixar vazio ou repetir o email.
      
      await tx.cliente.create({
        data: {
          nome: novoUsuario.nome,
          email: novoUsuario.email,
          documento: 'PENDENTE', // Ou peça o CPF no cadastro
          // Precisamos vincular este cliente a um "Dono" (User admin).
          // Como este é um auto-cadastro, precisamos definir quem é o 'userId' dono.
          // Se o sistema é só seu, você pode fixar seu ID de admin aqui, 
          // ou criar o cliente sem dono por enquanto (depende do seu schema).
          
          // SE O SEU SCHEMA 'Cliente' EXIGE 'userId' (User):
          // Isso complica um pouco o auto-cadastro, pois o cliente não pertence a ninguém ainda.
        }
      });
    });

    return NextResponse.json({ message: 'Conta criada com sucesso!' }, { status: 201 });