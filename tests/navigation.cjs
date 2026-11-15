exports.navigate = async (page, name) => {
  if (name === "Studio" || name === "Explore") {
    await page
      .getByRole("button", { name: "Sounds", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name, exact: true }).last().click();
  } else {
    await page.getByRole("button", { name, exact: true }).last().click();
    if (name === "Library")
      await page
        .getByRole("button", { name: "Audio library", exact: true })
        .click();
  }
};
