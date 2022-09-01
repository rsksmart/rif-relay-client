export function getApiTokenName(
    api: string,
    tokenSymbol: string,
    currencyMapping: Record<string, string>
) {
    if (!tokenSymbol) {
        throw Error(`${api} API cannot map a token with a null/empty value`);
    }
    const upperCaseTokenSymbol = tokenSymbol.toUpperCase();
    const resultMapping = currencyMapping[upperCaseTokenSymbol];
    if (!resultMapping) {
        throw Error(
            `Token ${upperCaseTokenSymbol} is not internally mapped in ${api} API`
        );
    }
    return resultMapping;
}
