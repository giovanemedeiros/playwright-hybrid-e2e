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

test.describe.serial('Hybrid E2E Flow - Serverest', () => {

  let userNumber: number;
  let productName: string;
  let productId: string;
  let adminToken: string;
  let clientToken: string;
  let adminId: string;
  let clientId: string;

  // ---- [AB#8] [Setup & Auth Bypass] Validar acesso autenticado à Home via injeção de token no localStorage ----
  test('Should bypass login by injecting token into localStorage and access home directly', async ({ page, request }) => {

    // Get incremental number and create user via API
    userNumber = getNextUserNumber();
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
    adminId = responseBodyAdmin._id;

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
    adminToken = loginResponseBodyAdmin.authorization;

    // Valid the message returned by API
    expect(loginResponseBodyAdmin.message).toBe('Login realizado com sucesso');

    // Valid pattern of authorization token generated 
    expect(loginResponseBodyAdmin.authorization).toMatch(/^Bearer/);

    productName = `Produto Carrinho QA ${userNumber}`;

    // Create product via API
    const productRegister = await request.post('https://serverest.dev/produtos', {
      headers: { Authorization: adminToken },
      data: {
        nome: productName,
        preco: 100,
        descricao: 'Mouse',
        quantidade: 10
      }
    });

    // Assertion of HTTP status code (201 Created)
    expect(productRegister.status()).toBe(201);

    // Parsing response body to JSON
    const productResponseBody = await productRegister.json();
    productId = productResponseBody._id;

    // Valid the message returned by API
    expect(productResponseBody.message).toBe('Cadastro realizado com sucesso');

    // Valid the _id generated and not empty
    expect(productResponseBody._id).toBeDefined();

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
    clientId = responseBodyRegularUser._id;

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
    clientToken = loginResponseBodyRegularUser.authorization;

    // Valid the message returned by API
    expect(loginResponseBodyRegularUser.message).toBe('Login realizado com sucesso');

    // Valid pattern of authorization token generated 
    expect(loginResponseBodyRegularUser.authorization).toMatch(/^Bearer/);

    // Inject token into localStorage
    await page.addInitScript(({ token }) => {
      window.localStorage.setItem('serverest/userToken', token);
    }, { token: clientToken });

    // Navigate to home page
    await page.goto('https://front.serverest.dev/home');

    // Verify that the page loaded
    await expect(page.getByText(/serverest store/i)).toBeVisible();

  });

  // ---- [AB#9] [UI E2E] Validar busca de produto no catálogo e adição ao carrinho ----
  test('Should search dynamic product in catalog and add to cart successfully', async ({ page }) => {

    // Inject token into localStorage
    await page.addInitScript(({ token }) => {
      window.localStorage.setItem('serverest/userToken', token);
    }, { token: clientToken });

    // Navigate to home page
    await page.goto('https://front.serverest.dev/home');

    // Verify that the page loaded
    await expect(page.getByText(/serverest store/i)).toBeVisible();

    const productCard = page.locator('.card').filter({ hasText: productName });
    await productCard.getByTestId('adicionarNaLista').click();

    await expect(page).toHaveURL(/minhaListaDeProdutos/);

    // Valid the dynamic product name
    await expect(page.getByText(new RegExp(productName, 'i'))).toBeVisible();

    // Valid total quantity is 1
    await expect(page.getByText('Total: 1')).toBeVisible();    

  });

  // ---- [AB#10] [UI E2E] Validar conferência de itens no carrinho e finalização da compra ----
  test('Should review cart items and complete checkout successfully', async ({ page }) => {

      // Inject token into localStorage
    await page.addInitScript(({ token }) => {
      window.localStorage.setItem('serverest/userToken', token);
    }, { token: clientToken });

    // Navigate to home page
    await page.goto('https://front.serverest.dev/home');

    // Verify that the page loaded
    await expect(page.getByText(/serverest store/i)).toBeVisible();

    const productCard = page.locator('.card').filter({ hasText: productName });
    await productCard.getByTestId('adicionarNaLista').click();

    await expect(page).toHaveURL(/minhaListaDeProdutos/);

    // Valid the dynamic product name
    await expect(page.getByText(new RegExp(productName, 'i'))).toBeVisible();

    // Valid total quantity is 1
    await expect(page.getByText('Total: 1')).toBeVisible();

    // Click on "Add to Cart" button to proceed to checkout
    await page.getByRole('button', { name: /adicionar no carrinho/i }).click();
    
    // Valid redirection to information screen
    await expect(page.getByText(/em construção aguarde/i)).toBeVisible();

  });

  // ---- [AB#11] [Teardown & CI/CD] Validar limpeza de dados via API e execução no GitHub Actions ----
  test('Should delete cart, product and users via API teardown successfully', async ({ request }) => {

  });

});

