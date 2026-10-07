import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Helper Function
function getNextUserNumber() {
  const filePath = path.resolve('counter.json');
  let currentNumber = 1;

  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    currentNumber = JSON.parse(data).count || 1;
  }

  // Writes the next number (+1) to counter.json file
  fs.writeFileSync(filePath, JSON.stringify({ count: currentNumber + 1 }, null, 2));
  return currentNumber;
}

test.describe('Hybrid E2E Flow - Serverest', () => {

  // ---- [AB#8] [Setup & Auth Bypass] Validar acesso autenticado à Home via injeção de token no localStorage ----
  test('Should bypass login by injecting token into localStorage and access home directly', async ({ page, request }) => {

    // Get incremental number and create user via API
    const userNumber = getNextUserNumber();
    const randomAdminUser = `adminqap6v${userNumber}`;
    const randomAdminEmail = `adminqap6v${userNumber}@email.com`;
    const randomClientUser = `clientqap6v${userNumber}`;
    const randomClientEmail = `clientqap6v${userNumber}@email.com`;


    // Create admin user via API
    const userAdminRegister = await request.post('https://serverest.dev/usuarios', {
      data: {
        nome: randomAdminUser,
        email: randomAdminEmail,
        password: 'teste',
        administrador: 'true'
      }
    });

    // Assertion of HTTP status code (201 Created)
    expect(userAdminRegister.status()).toBe(201);

    // Parsing response body to JSON
    const responseBodyAdmin = await userAdminRegister.json();

    // Valid the message returned by API
    expect(responseBodyAdmin.message).toBe('Cadastro realizado com sucesso');

    // Valid the _id generated and not empty
    expect(responseBodyAdmin._id).toBeDefined();

    // Login with valid credentials
    const userAdminLogin = await request.post('https://serverest.dev/login', {
      data: {
        email: randomAdminEmail,
        password: 'teste'
      }
    });

    // Assertion of HTTP status code (200 OK)
    expect(userAdminLogin.status()).toBe(200);

    // Parsing response body to JSON
    const loginResponseBodyAdmin = await userAdminLogin.json();

    // Valid the message returned by API
    expect(loginResponseBodyAdmin.message).toBe('Login realizado com sucesso');

    // Valid pattern of authorization token generated 
    expect(loginResponseBodyAdmin.authorization).toMatch(/^Bearer/);

    // Create product via API
    const productRegister = await request.post('https://serverest.dev/produtos', {
      headers: { Authorization: loginResponseBodyAdmin.authorization },
      data: {
        nome: `Produto Carrinho QA ${userNumber}`,
        preco: 100,
        descricao: 'Mouse',
        quantidade: 10
      }
    });

    // Create regular user via API
    const userRegularRegister = await request.post('https://serverest.dev/usuarios', {
      data: {
        nome: randomClientUser,
        email: randomClientEmail,
        password: 'teste',
        administrador: 'false'
      }
    });

    // Assertion of HTTP status code (201 Created)
    expect(userRegularRegister.status()).toBe(201);

    // Parsing response body to JSON
    const responseBodyRegularUser = await userRegularRegister.json();

    // Valid the message returned by API
    expect(responseBodyRegularUser.message).toBe('Cadastro realizado com sucesso');

    // Valid the _id generated and not empty
    expect(responseBodyRegularUser._id).toBeDefined();

    // Login with valid credentials
    const userRegularLogin = await request.post('https://serverest.dev/login', {
      data: {
        email: randomClientEmail,
        password: 'teste'
      }
    });

    // Assertion of HTTP status code (200 OK)
    expect(userRegularLogin.status()).toBe(200);

    // Parsing response body to JSON
    const loginResponseBodyRegularUser = await userRegularLogin.json();

    // Valid the message returned by API
    expect(loginResponseBodyRegularUser.message).toBe('Login realizado com sucesso');

    // Valid pattern of authorization token generated 
    expect(loginResponseBodyRegularUser.authorization).toMatch(/^Bearer/);

    // Inject token into localStorage
    await page.addInitScript(({ token }) => {
      window.localStorage.setItem('serverest/userToken', token);
    }, { token: loginResponseBodyRegularUser.authorization });

    // Navigate to home page
    await page.goto('https://front.serverest.dev/home');

    // Verify that the page loaded
    await expect(page.getByText(/serverest store/i)).toBeVisible();
    // await page.waitForTimeout(5000);

  });

});
